import { removeDuplicates, CONTROL_LABELS, getConfig, getLogger, withRetry } from "@octosync/utils";
import {
  handleClosedIssue,
  handleIssueCommentCreation,
  handleOpenedIssue,
  handleEditedIssue,
} from "@octosync/handlers";
import { webhook } from "../router";
import { IssuePayload } from "./types";

const config = getConfig();
const logger = getLogger();
const GITHUB_TOKEN = config.github.token;

webhook.post("/github", async (req, res) => {
  const reqBody = req.body as IssuePayload;

  try {
    const {
      action,
      issue: { title, body, number: ghIssueNumber, labels: ghLabels, assignee },
      sender,
      comment,
      repository: {
        name: repositoryName,
        owner: { login: organizationName },
      },
    } = reqBody;
    const triggererEmail = reqBody.issue.user.login;

    logger.info(`Received GitHub webhook: ${action} for issue #${ghIssueNumber} in ${organizationName}/${repositoryName}`);

    // This means that this issue has already been created,
    // and this hook must finish executing immediately.
    if (
      action === "opened" &&
      ghLabels.some((label) => label.name === CONTROL_LABELS.FROM_JIRA)
    ) {
      logger.debug(`Issue #${ghIssueNumber} has FROM_JIRA label, skipping to prevent loop`);
      res.status(409).end("Conflict");
      return res;
    }

    let labels = ghLabels.map((label) => label.name);
    labels.push(CONTROL_LABELS.FROM_GITHUB);
    labels = removeDuplicates(labels);

    switch (action) {
      case "opened":
        await withRetry(async () => {
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
        });
        logger.info(`Successfully synced opened issue #${ghIssueNumber} to Jira`);
        break;
      case "edited":
        // Skip if this is a control label edit
        if (ghLabels.some((label) => label.name === CONTROL_LABELS.FROM_JIRA)) {
          logger.debug(`Issue #${ghIssueNumber} edit from Jira, skipping to prevent loop`);
          res.status(409).end("Conflict");
          return res;
        }

        const edited = await withRetry(async () => {
          return await handleEditedIssue({
            clients: {
              github: {
                auth: GITHUB_TOKEN,
              },
            },
            organization: organizationName,
            title,
            body,
            labels,
            issueNumber: ghIssueNumber,
            repository: repositoryName,
            assignee: assignee?.login || null,
          });
        });

        if (!edited) {
          logger.debug(`No Jira issue found or no updates needed for #${ghIssueNumber}`);
        } else {
          logger.info(`Successfully synced edited issue #${ghIssueNumber} to Jira`);
        }
        break;
      case "closed":
        const success = await withRetry(async () => {
          return await handleClosedIssue({ title });
        });

        if (!success) {
          logger.warn(`Could not find Jira issue key in title: ${title}`);
          res.status(422).end("Unprocessable Entity");
          return res;
        }

        logger.info(`Successfully closed Jira issue for GitHub #${ghIssueNumber}`);
        break;
      case "created":
        const result = await withRetry(async () => {
          return await handleIssueCommentCreation({
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
          });
        });

        if (result === "conflict") {
          logger.debug(`Comment on issue #${ghIssueNumber} is a sync comment, skipping`);
          res.status(409).end("Conflict");
          return res;
        }

        if (result === "unprocessableEntity") {
          logger.warn(`Could not find Jira issue key in title for comment: ${title}`);
          res.status(422).end("Unprocessable Entity");
          return res;
        }

        logger.info(`Successfully synced comment on issue #${ghIssueNumber} to Jira`);
        break;
      default:
        logger.debug(`Unhandled GitHub action: ${action}`);
        break;
    }
  } catch (error: any) {
    logger.error(`Error processing GitHub webhook`, { error: error.message, stack: error.stack });
    res.status(400).end("Bad Request");
    return res;
  }

  res.setHeader("Content-Type", "application/json");
  res.status(202).json("Accepted");

  return res;
});

export { webhook as github };
