import { github, jira } from "@octosync/clients";
import { getConfig, getLogger, withRetry } from "@octosync/utils";
import {
  removeDuplicates,
  CONTROL_COMMENT_BODY,
  CONTROL_LABELS,
  STRING_AFTER_LAST_SLASH_REGEX,
} from "@octosync/utils";
import { webhook } from "../router";
import { IssuePayload } from "./types";

const config = getConfig();
const logger = getLogger();

webhook.post("/jira", async (req, res) => {
  const reqBody = req.body as IssuePayload;

  const GITHUB_REPOSITORY = config.github.repository;
  const JIRA_DONE_STATUS_NAME = config.jira.doneStatusName;
  const JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD = `customfield_${config.jira.customFields.githubIssueNumber}`;
  const JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD = `customfield_${config.jira.customFields.githubRepository}`;

  try {
    const {
      webhookEvent,
      comment,
      issue: {
        fields: { summary, description, labels: jiraLabels, status, assignee },
        key,
      },
    } = reqBody;

    logger.info(`Received Jira webhook: ${webhookEvent} for issue ${key}`);

    switch (webhookEvent) {
      case "jira:issue_created":
        // This means that this issue has already been created,
        // and this hook must finish executing immediately.
        if (jiraLabels?.includes(CONTROL_LABELS.FROM_GITHUB)) {
          logger.debug(`Issue ${key} has FROM_GITHUB label, skipping to prevent loop`);
          res.status(409).end("Conflict");
          return res;
        }

        jiraLabels.push(CONTROL_LABELS.FROM_JIRA);

        const labels = removeDuplicates(jiraLabels);

        await withRetry(async () => {
          const { data: issue } = await github.createIssue({
            repository: GITHUB_REPOSITORY,
            title: `${key} - ${summary}`,
            body: description,
            labels,
          });

          await jira.updateIssueWithGithubData({
            issueKey: key,
            repository: issue.repository_url.match(
              STRING_AFTER_LAST_SLASH_REGEX
            )![0],
            issueNumber: issue.number.toString(),
          });
        });

        logger.info(`Successfully created GitHub issue for Jira ${key}`);
        break;
      case "jira:issue_updated":
        const ghIssueNumber = reqBody.issue.fields[JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD];
        const ghRepository = reqBody.issue.fields[JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD];

        if (!ghIssueNumber || !ghRepository) {
          logger.debug(`Issue ${key} not linked to GitHub, skipping update`);
          break;
        }

        // Skip if this is a FROM_JIRA labeled issue being updated
        if (jiraLabels?.includes(CONTROL_LABELS.FROM_GITHUB)) {
          logger.debug(`Issue ${key} update from GitHub, skipping to prevent loop`);
          res.status(409).end("Conflict");
          return res;
        }

        await withRetry(async () => {
          const updates: any = {
            issueNumber: ghIssueNumber,
            repository: ghRepository,
          };

          // Handle status change (close/reopen)
          if (status.name === JIRA_DONE_STATUS_NAME) {
            updates.state = "closed";
            logger.debug(`Closing GitHub issue #${ghIssueNumber} for Jira ${key}`);
          }

          // Sync description if configured
          if (config.sync?.descriptions && description) {
            updates.body = description;
            logger.debug(`Updating description for GitHub #${ghIssueNumber}`);
          }

          // Sync labels if configured
          if (config.sync?.labels && jiraLabels) {
            const syncLabels = jiraLabels.filter(l => 
              l !== "source:github" && l !== "source:jira"
            );
            if (syncLabels.length > 0) {
              syncLabels.push(CONTROL_LABELS.FROM_JIRA);
              updates.labels = removeDuplicates(syncLabels);
              logger.debug(`Updating labels for GitHub #${ghIssueNumber}`, { labels: updates.labels });
            }
          }

          // Sync assignees if configured
          if (config.sync?.assignees && assignee) {
            // For GitHub, we need username not email
            // This is a limitation - we'd need a mapping or use the display name
            logger.debug(`Assignee update detected but username mapping not implemented yet`);
          }

          await github.updateIssue(updates);
        });

        logger.info(`Successfully synced updates from Jira ${key} to GitHub #${ghIssueNumber}`);
        break;
      case "comment_created":
        const commentBody = comment?.body;

        if (!commentBody) {
          logger.warn(`Received comment_created without body for ${key}`);
          res.status(400).end("Bad Request");
          return res;
        }

        // Prevents duplicating a comment that came from Github, on Github
        if (
          commentBody.includes(CONTROL_COMMENT_BODY.FROM_GITHUB) ||
          commentBody.includes(CONTROL_COMMENT_BODY.FROM_JIRA)
        ) {
          logger.debug(`Comment on ${key} is a sync comment, skipping`);
          res.status(409).end("Conflict");
          return res;
        }

        await withRetry(async () => {
          const jiraIssue = await jira.getIssue(key);

          if (!jiraIssue) {
            logger.warn(`Could not find Jira issue ${key}`);
            res.status(404).end("Not Found");
            return;
          }

          const customBody = `${commentBody}\n\n${CONTROL_COMMENT_BODY.FROM_JIRA} by ${comment?.author.displayName}`;

          await github.commentIssue({
            issueNumber: jiraIssue.fields[JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD],
            repository: jiraIssue.fields[JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD],
            body: customBody,
          });
        });

        logger.info(`Successfully synced comment from Jira ${key} to GitHub`);
        break;
      default:
        logger.debug(`Unhandled Jira event: ${webhookEvent}`);
        break;
    }
  } catch (error: any) {
    logger.error(`Error processing Jira webhook`, { error: error.message, stack: error.stack });
    res.status(400).end("Bad Request");
    return res;
  }

  res.setHeader("Content-Type", "application/json");
  res.status(202).json("Accepted");

  return res;
});

export { webhook as jira };
