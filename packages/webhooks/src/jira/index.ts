import { github, jira } from "@IssueForge/clients";
import { db } from "@IssueForge/db";
import { useEnv, logger } from "@IssueForge/utils";
import {
  removeDuplicates,
  CONTROL_COMMENT_BODY,
  CONTROL_LABELS,
  STRING_AFTER_LAST_SLASH_REGEX,
} from "@IssueForge/utils";
import { webhook } from "../router";
import { IssuePayload } from "./types";

webhook.post("/jira", async (req, res) => {
  const reqBody = req.body as IssuePayload;

  // Debug: Log the full webhook payload to diagnose comment events
  logger.info(`Jira webhook received (full payload)`, {
    context: "Jira-Debug",
    data: {
      webhookEvent: reqBody.webhookEvent,
      issueKey: reqBody.issue?.key,
      hasComment: !!reqBody.comment,
      commentBody: reqBody.comment?.body?.substring(0, 50),
    },
  });

  const {
    GITHUB_REPOSITORY,
    JIRA_DONE_STATUS_NAME,
    JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD,
    JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD,
  } = useEnv();

  try {
    const {
      webhookEvent,
      comment,
      issue: {
        fields: { summary, description, labels: jiraLabels, status },
        key,
      },
    } = reqBody;

    logger.info(`Jira webhook received: ${webhookEvent}`, {
      context: "Jira",
      data: { event: webhookEvent, issueKey: key, summary },
    });

    switch (webhookEvent) {
      case "jira:issue_created":
        // This means that this issue has already been created,
        // and this hook must finish executing immediately.
        if (jiraLabels?.includes(CONTROL_LABELS.FROM_GITHUB)) {
          logger.warn(`Skipping Jira issue ${key} - already synced from GitHub`, {
            context: "Jira",
          });
          res.status(409).end("Conflict");
          return res;
        }

        jiraLabels.push(CONTROL_LABELS.FROM_JIRA);

        const labels = removeDuplicates(jiraLabels);

        const { data: issue } = await github.createIssue({
          repository: GITHUB_REPOSITORY,
          title: `${key} - ${summary}`,
          body: description,
          labels,
        });


        const ghRepo = issue.repository_url.match(STRING_AFTER_LAST_SLASH_REGEX)![0];
        const ghIssueNum = issue.number;

        // Store mapping in DB
        db.get().saveIssueMapping({
          jiraIssueKey: key,
          githubRepository: ghRepo,
          githubIssueNumber: ghIssueNum,
        });

        await jira.updateIssueWithGithubData({
          issueKey: key,
          repository: ghRepo,
          issueNumber: ghIssueNum.toString(),
        });

        logger.success(`Jira issue ${key} synced to GitHub #${ghIssueNum}`, {
          context: "Jira",
        });
        break;

      case "jira:issue_updated":

        let ghIssueNumberUpdated = reqBody.issue.fields[JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD];
        let ghRepositoryUpdated = reqBody.issue.fields[JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD];

        // Fallback to DB mapping if custom fields are missing
        if (!ghIssueNumberUpdated || !ghRepositoryUpdated) {
          const mapping = db.get().getGithubIssueMapping(key);
          if (mapping) {
            ghIssueNumberUpdated = mapping.githubIssueNumber;
            ghRepositoryUpdated = mapping.githubRepository;
            logger.info(`Used DB mapping for Jira issue ${key} in update handler`, {
              context: "Jira",
              data: { ghIssueNumberUpdated, ghRepositoryUpdated },
            });
          } else {
            logger.warn(`Jira issue ${key} missing GitHub metadata and DB mapping, cannot sync update`, {
              context: "Jira",
            });
            break;
          }
        }

        // Handle status change to Done
        if (status.name === JIRA_DONE_STATUS_NAME) {
          await github.updateIssue({
            issueNumber: ghIssueNumberUpdated,
            repository: ghRepositoryUpdated,
            state: "closed",
          });

          logger.success(`Jira issue ${key} transitioned to Done, GitHub #${ghIssueNumberUpdated} closed`, {
            context: "Jira",
          });
        }

        // Parse changelog for field changes
        if (reqBody.changelog?.items) {
          for (const change of reqBody.changelog.items) {
            try {
              if (change.field === "summary" && change.toString) {
                // Update GitHub title while preserving Jira key prefix
                const newTitle = `${key} - ${change.toString}`;
                await github.updateIssue({
                  issueNumber: ghIssueNumberUpdated,
                  repository: ghRepositoryUpdated,
                  title: newTitle,
                });
                logger.success(`Updated GitHub #${ghIssueNumberUpdated} title from Jira summary change`, {
                  context: "Jira",
                });
              }

              if (change.field === "description" && change.toString !== null) {
                await github.updateIssue({
                  issueNumber: ghIssueNumberUpdated,
                  repository: ghRepositoryUpdated,
                  body: change.toString,
                });
                logger.success(`Updated GitHub #${ghIssueNumberUpdated} description from Jira`, {
                  context: "Jira",
                });
              }

              if (change.field === "labels" && change.toString !== null) {
                const newLabels = change.toString.split(" ").filter((l: string) => 
                  l && l !== CONTROL_LABELS.FROM_GITHUB && l !== CONTROL_LABELS.FROM_JIRA
                );
                await github.replaceAllLabels({
                  repository: ghRepositoryUpdated,
                  issueNumber: ghIssueNumberUpdated,
                  labels: newLabels,
                });
                logger.success(`Synced labels to GitHub #${ghIssueNumberUpdated}`, {
                  context: "Jira",
                  data: { labels: newLabels },
                });
              }

              if (change.field === "assignee") {
                if (change.to) {
                  // Try to find GitHub username for this Jira account ID
                  const githubUsername = db.get().getGithubUsername(change.to);
                  
                  if (githubUsername) {
                    await github.addAssignees({
                      repository: ghRepositoryUpdated,
                      issueNumber: ghIssueNumberUpdated,
                      assignees: [githubUsername],
                    });
                    logger.success(`Assigned GitHub #${ghIssueNumberUpdated} to ${githubUsername}`, {
                      context: "Jira",
                    });
                  } else {
                    logger.warn(`Cannot assign GitHub issue - no username mapping for Jira account ${change.to}`, {
                      context: "Jira",
                    });
                  }
                } else {
                  // Unassigned
                  const currentAssignees = reqBody.issue.fields.assignee ? [reqBody.issue.fields.assignee.displayName] : [];
                  if (currentAssignees.length > 0) {
                    await github.removeAssignees({
                      repository: ghRepositoryUpdated,
                      issueNumber: ghIssueNumberUpdated,
                      assignees: currentAssignees,
                    });
                    logger.success(`Unassigned GitHub #${ghIssueNumberUpdated}`, {
                      context: "Jira",
                    });
                  }
                }
              }
            } catch (error) {
              logger.error(`Failed to sync Jira change ${change.field} to GitHub`, {
                context: "Jira",
                data: error,
              });
            }
          }
        }
        break;

      case "comment_created":
        const commentBody = comment?.body;

        if (!commentBody) {
          logger.error(`Jira comment webhook missing comment body`, {
            context: "Jira",
          });
          res.status(400).end("Bad Request");
          return res;
        }

        // Prevents duplicating a comment that came from Github, on Github
        if (
          commentBody.includes(CONTROL_COMMENT_BODY.FROM_GITHUB) ||
          commentBody.includes(CONTROL_COMMENT_BODY.FROM_JIRA)
        ) {
          logger.warn(`Skipping Jira comment on ${key} - already synced`, {
            context: "Jira",
          });
          res.status(409).end("Conflict");
          return res;
        }

        const jiraIssue = await jira.getIssue(key);

        if (!jiraIssue) {
          logger.error(`Jira issue ${key} not found`, {
            context: "Jira",
          });
          res.status(404).end("Not Found");
          return res;
        }



        let ghIssueNumber = jiraIssue.fields[JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD];
        let ghRepository = jiraIssue.fields[JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD];

        // Fallback to DB mapping if custom fields are missing
        if (!ghIssueNumber || !ghRepository) {
          const mapping = db.get().getGithubIssueMapping(key);
          if (mapping) {
            ghIssueNumber = mapping.githubIssueNumber;
            ghRepository = mapping.githubRepository;
            logger.info(`Used DB mapping for Jira issue ${key}`, {
              context: "Jira",
              data: { ghIssueNumber, ghRepository },
            });
          } else {
            logger.error(`Jira issue ${key} missing GitHub custom fields and DB mapping`, {
              context: "Jira",
              data: {
                ghIssueNumber,
                ghRepository,
                availableFields: Object.keys(jiraIssue.fields),
              },
            });
            res.status(422).end("Unprocessable Entity");
            return res;
          }
        }

        const customBody = `${commentBody}\n\n${CONTROL_COMMENT_BODY.FROM_JIRA}`;

        const ghCommentResult = await github.commentIssue({
          issueNumber: ghIssueNumber,
          repository: ghRepository,
          body: customBody,
        });

        // Store comment ID mapping
        if (comment && ghCommentResult.data.id) {
          db.get().saveCommentMapping({
            githubCommentId: ghCommentResult.data.id,
            jiraCommentId: comment.id,
            githubIssueNumber: ghIssueNumber,
            githubRepository: ghRepository,
            jiraIssueKey: key,
          });
        }

        logger.success(`Jira comment on ${key} synced to GitHub`, {
          context: "Jira",
        });
        break;

      case "jira:issue_deleted":
        // Try to get GitHub metadata from the issue payload

        const ghIssueNumDeleted = reqBody.issue?.fields?.[JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD];
        const ghRepoDeleted = reqBody.issue?.fields?.[JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD];


        if (!ghIssueNumDeleted || !ghRepoDeleted) {
          logger.warn(`Cannot close GitHub issue for deleted Jira issue ${key} - GitHub metadata not found in webhook payload`, {
            context: "Jira",
          });
          break;
        }

        try {
          await github.updateIssue({
            issueNumber: ghIssueNumDeleted,
            repository: ghRepoDeleted,
            state: "closed",
          });

          await github.commentIssue({
            issueNumber: ghIssueNumDeleted,
            repository: ghRepoDeleted,
            body: `⚠️ The linked Jira issue ${key} has been deleted. This GitHub issue has been closed automatically.`,
          });

          logger.success(`Jira issue ${key} deleted, GitHub #${ghIssueNumDeleted} closed with notification`, {
            context: "Jira",
          });
        } catch (error) {
          logger.error(`Failed to close GitHub issue #${ghIssueNumDeleted} for deleted Jira issue ${key}`, {
            context: "Jira",
            data: error,
          });
        }
        break;

      case "comment_updated":
        const updatedCommentBody = comment?.body;
        const updatedCommentId = comment?.id;

        if (!updatedCommentBody || !updatedCommentId) {
          logger.error(`Jira comment_updated webhook missing data`, {
            context: "Jira",
          });
          res.status(400).end("Bad Request");
          return res;
        }

        // Skip if this is a synced comment
        if (
          updatedCommentBody.includes(CONTROL_COMMENT_BODY.FROM_GITHUB) ||
          updatedCommentBody.includes(CONTROL_COMMENT_BODY.FROM_JIRA)
        ) {
          logger.warn(`Skipping Jira comment update on ${key} - already synced`, {
            context: "Jira",
          });
          res.status(409).end("Conflict");
          return res;
        }

        // Get GitHub comment ID from mapping
        const ghCommentId = db.get().getGithubCommentId(updatedCommentId);

        if (!ghCommentId) {
          logger.warn(`Cannot update GitHub comment - no mapping found for Jira comment ${updatedCommentId}`, {
            context: "Jira",
          });
          break;
        }

        const jiraIssueForUpdate = await jira.getIssue(key);
        const ghRepoForUpdate = jiraIssueForUpdate?.fields[JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD];

        if (!ghRepoForUpdate) {
          logger.error(`Cannot update GitHub comment - Jira issue ${key} missing repository field`, {
            context: "Jira",
          });
          break;
        }

        try {
          await github.updateIssueComment({
            owner: process.env.GITHUB_ORGANIZATION || "",
            repository: ghRepoForUpdate,
            commentId: ghCommentId,
            body: `${updatedCommentBody}\n\n${CONTROL_COMMENT_BODY.FROM_JIRA}`,
          });

          logger.success(`Updated GitHub comment from Jira comment ${updatedCommentId}`, {
            context: "Jira",
          });
        } catch (error) {
          logger.error(`Failed to update GitHub comment`, {
            context: "Jira",
            data: error,
          });
        }
        break;

      case "comment_deleted":
        const deletedCommentId = comment?.id;

        if (!deletedCommentId) {
          logger.error(`Jira comment_deleted webhook missing comment ID`, {
            context: "Jira",
          });
          res.status(400).end("Bad Request");
          return res;
        }

        // Get GitHub comment ID from mapping
        const ghCommentIdToDelete = db.get().getGithubCommentId(deletedCommentId);

        if (!ghCommentIdToDelete) {
          logger.warn(`Cannot delete GitHub comment - no mapping found for Jira comment ${deletedCommentId}`, {
            context: "Jira",
          });
          break;
        }

        const jiraIssueForDelete = await jira.getIssue(key);
        const ghRepoForDelete = jiraIssueForDelete?.fields[JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD];

        if (!ghRepoForDelete) {
          logger.error(`Cannot delete GitHub comment - Jira issue ${key} missing repository field`, {
            context: "Jira",
          });
          break;
        }

        try {
          await github.deleteComment({
            repository: ghRepoForDelete,
            commentId: ghCommentIdToDelete,
          });

          // Remove from database
          db.get().deleteCommentMappingByJiraId(deletedCommentId);

          logger.success(`Deleted GitHub comment from Jira comment deletion`, {
            context: "Jira",
          });
        } catch (error) {
          logger.error(`Failed to delete GitHub comment`, {
            context: "Jira",
            data: error,
          });
        }
        break;

      default:
        logger.info(`Jira event '${webhookEvent}' not handled`, {
          context: "Jira",
        });
        break;
    }
  } catch (error) {
    logger.error(`Error processing Jira webhook`, {
      context: "Jira",
      data: error,
    });
    res.status(400).end("Bad Request");
    return res;
  }

  res.setHeader("Content-Type", "application/json");
  res.status(202).json("Accepted");

  return res;
});

export { webhook as jira };
