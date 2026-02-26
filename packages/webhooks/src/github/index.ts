import { removeDuplicates, CONTROL_LABELS, useEnv, logger, reverse, ISSUE_KEY_REGEX } from "@IssueForge/utils";
import {
  handleClosedIssue,
  handleIssueCommentCreation,
  handleOpenedIssue,
} from "@IssueForge/handlers";
import { jira } from "@IssueForge/clients";
import { db } from "@IssueForge/db";
import { webhook } from "../router";
import { IssuePayload } from "./types";

const { GITHUB_TOKEN, JIRA_ISSUER_EMAIL } = useEnv();

webhook.post("/github", async (req, res) => {
  const reqBody = req.body as IssuePayload;

  try {
    const {
      action,
      issue: { title, body, number: ghIssueNumber, labels: ghLabels },
      sender,
      comment,
      repository: {
        name: repositoryName,
        owner: { login: organizationName },
      },
    } = reqBody;
    const triggererEmail = JIRA_ISSUER_EMAIL;

    logger.info(`GitHub webhook received: ${action}`, {
      context: "GitHub",
      data: { action, issueNumber: ghIssueNumber, title, repository: repositoryName },
    });

    // This means that this issue has already been created,
    // and this hook must finish executing immediately.
    if (
      action === "opened" &&
      ghLabels.some((label) => label.name === CONTROL_LABELS.FROM_JIRA)
    ) {
      logger.warn(`Skipping GitHub issue #${ghIssueNumber} - already synced from Jira`, {
        context: "GitHub",
      });
      res.status(409).end("Conflict");
      return res;
    }

    let labels = ghLabels.map((label) => label.name);
    labels.push(CONTROL_LABELS.FROM_GITHUB);
    labels = removeDuplicates(labels);

    switch (action) {
      case "opened":
        await handleOpenedIssue({
          clients: {
            github: {
              auth: GITHUB_TOKEN,
            },
          },
          organization: organizationName,
          title,
          triggererEmail,
          body,
          labels,
          issueNumber: ghIssueNumber,
          repository: repositoryName,
        });
        logger.success(`GitHub issue #${ghIssueNumber} synced to Jira`, {
          context: "GitHub",
        });
        break;
      case "closed":
        const success = await handleClosedIssue({
          title,
          repository: repositoryName,
          issueNumber: ghIssueNumber,
        });

        if (!success) {
          logger.error(`Failed to close Jira issue for GitHub #${ghIssueNumber} - Jira key not found in title`, {
            context: "GitHub",
            data: { title },
          });
          res.status(422).end("Unprocessable Entity");
          return res;
        }

        logger.success(`GitHub issue #${ghIssueNumber} closed, Jira issue transitioned to Done`, {
          context: "GitHub",
        });
        break;
      case "created":
        const result = await handleIssueCommentCreation({
          clients: {
            github: {
              auth: GITHUB_TOKEN,
            },
          },
          title,
          body: comment.body,
          owner: sender.login,
          repository: repositoryName,
          commentId: comment.id,
          issueNumber: ghIssueNumber,
        });

        if (result === "conflict") {
          logger.warn(`Skipping comment on GitHub #${ghIssueNumber} - already synced`, {
            context: "GitHub",
          });
          res.status(409).end("Conflict");
          return res;
        }

        if (result === "unprocessableEntity") {
          logger.error(`Failed to sync comment on GitHub #${ghIssueNumber} - Jira key not found`, {
            context: "GitHub",
          });
          res.status(422).end("Unprocessable Entity");
          return res;
        }
        
        logger.success(`Comment on GitHub #${ghIssueNumber} synced to Jira`, {
          context: "GitHub",
        });
        break;
      case "deleted":
        const match = reverse(title).match(ISSUE_KEY_REGEX);
        
        if (!match) {
          logger.warn(`Cannot delete Jira issue for GitHub #${ghIssueNumber} - Jira key not found in title`, {
            context: "GitHub",
            data: { title },
          });
          break;
        }

        const jiraKey = reverse(match[0]);
        
        try {
          await jira.deleteIssue(jiraKey);
          logger.success(`GitHub issue #${ghIssueNumber} deleted, Jira issue ${jiraKey} deleted`, {
            context: "GitHub",
          });
        } catch (error) {
          logger.error(`Failed to delete Jira issue ${jiraKey} for GitHub #${ghIssueNumber}`, {
            context: "GitHub",
            data: error,
          });
        }
        break;
      
      case "edited":
        const editedMatch = reverse(title).match(ISSUE_KEY_REGEX);
        
        if (!editedMatch) {
          logger.warn(`Cannot update Jira issue for GitHub #${ghIssueNumber} - Jira key not found in title`, {
            context: "GitHub",
            data: { title },
          });
          break;
        }

        const editedJiraKey = reverse(editedMatch[0]);
        const changes = reqBody.changes;

        try {
          if (changes?.title) {
            // Extract just the title part (after Jira key)
            const newTitleMatch = title.match(/^[A-Z]+-\d+\s+-\s+(.+)$/);
            const newSummary = newTitleMatch ? newTitleMatch[1] : title;
            
            await jira.updateIssue({
              issueKey: editedJiraKey,
              summary: newSummary,
            });
            
            logger.success(`Updated Jira issue ${editedJiraKey} summary from GitHub edit`, {
              context: "GitHub",
            });
          }

          if (changes?.body) {
            await jira.updateIssue({
              issueKey: editedJiraKey,
              description: body,
            });
            
            logger.success(`Updated Jira issue ${editedJiraKey} description from GitHub edit`, {
              context: "GitHub",
            });
          }
        } catch (error) {
          logger.error(`Failed to update Jira issue ${editedJiraKey}`, {
            context: "GitHub",
            data: error,
          });
        }
        break;

      case "labeled":
      case "unlabeled":
        const labelMatch = reverse(title).match(ISSUE_KEY_REGEX);
        
        if (!labelMatch) {
          logger.warn(`Cannot sync labels to Jira for GitHub #${ghIssueNumber} - Jira key not found in title`, {
            context: "GitHub",
          });
          break;
        }

        const labelJiraKey = reverse(labelMatch[0]);
        
        // Filter out control labels
        const currentLabels = ghLabels
          .map((l) => l.name)
          .filter((name) => name !== CONTROL_LABELS.FROM_GITHUB && name !== CONTROL_LABELS.FROM_JIRA);

        try {
          await jira.updateIssue({
            issueKey: labelJiraKey,
            labels: currentLabels,
          });
          
          logger.success(`Synced labels to Jira issue ${labelJiraKey}`, {
            context: "GitHub",
            data: { labels: currentLabels },
          });
        } catch (error) {
          logger.error(`Failed to sync labels to Jira issue ${labelJiraKey}`, {
            context: "GitHub",
            data: error,
          });
        }
        break;

      case "assigned":
      case "unassigned":
        const assignMatch = reverse(title).match(ISSUE_KEY_REGEX);
        
        if (!assignMatch) {
          logger.warn(`Cannot sync assignee to Jira for GitHub #${ghIssueNumber} - Jira key not found in title`, {
            context: "GitHub",
          });
          break;
        }

        const assignJiraKey = reverse(assignMatch[0]);
        const assignee = reqBody.assignee || reqBody.issue.assignee;

        try {
          if (action === "assigned" && assignee) {
            // Try to get Jira account ID from database or environment
            let jiraAccountId = db.get().getJiraAccountId(assignee.login);

            if (!jiraAccountId) {
              // Try to map via environment variable (format: "githubuser1:jiraaccount1,githubuser2:jiraaccount2")
              const userMappings = process.env.GITHUB_JIRA_USER_MAPPINGS || "";
              const mappings = userMappings.split(",").map((m) => m.split(":"));
              const mapping = mappings.find(([ghUser]) => ghUser === assignee.login);
              
              if (mapping && mapping[1]) {
                jiraAccountId = mapping[1];
                // Store for future use
                db.get().saveUserMapping(assignee.login, jiraAccountId);
              }
            }

            if (jiraAccountId) {
              await jira.updateIssue({
                issueKey: assignJiraKey,
                assignee: { accountId: jiraAccountId },
              });
              
              logger.success(`Assigned Jira issue ${assignJiraKey} to ${assignee.login}`, {
                context: "GitHub",
              });
            } else {
              logger.warn(`Cannot assign Jira issue ${assignJiraKey} - no Jira account ID mapping for GitHub user ${assignee.login}`, {
                context: "GitHub",
              });
            }
          } else if (action === "unassigned") {
            await jira.updateIssue({
              issueKey: assignJiraKey,
              assignee: null,
            });
            
            logger.success(`Unassigned Jira issue ${assignJiraKey}`, {
              context: "GitHub",
            });
          }
        } catch (error) {
          logger.error(`Failed to sync assignee to Jira issue ${assignJiraKey}`, {
            context: "GitHub",
            data: error,
          });
        }
        break;

      default:
        logger.info(`GitHub action '${action}' not handled`, {
          context: "GitHub",
        });
        break;
    }
  } catch (error) {
    logger.error(`Error processing GitHub webhook`, {
      context: "GitHub",
      data: error,
    });
    res.status(400).end("Bad Request");
    return res;
  }

  res.setHeader("Content-Type", "application/json");
  res.status(202).json("Accepted");

  return res;
});

export { webhook as github };
