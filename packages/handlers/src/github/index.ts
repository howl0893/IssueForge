import { jira } from "@octosync/clients";
import {
  reverse,
  ISSUE_KEY_REGEX,
  CONTROL_COMMENT_BODY,
  getLogger,
  getConfig,
} from "@octosync/utils";
import { Clients } from "../types";
import { resolveGithubClient } from "./utils";

const logger = getLogger();
const config = getConfig();

export async function handleOpenedIssue(params: {
  clients: Clients;
  title: string;
  triggererEmail: string;
  body: string;
  labels: string[];
  issueNumber: number;
  organization: string;
  repository: string;
  state?: "open" | "closed";
}) {
  const {
    clients,
    organization,
    title,
    triggererEmail,
    body,
    labels,
    issueNumber,
    repository,
    state,
  } = params;

  const github = resolveGithubClient(clients);

  logger.debug(`Creating Jira issue for GitHub #${issueNumber}`, { title, repository });

  const issue = await jira.createJiraIssue(
    title,
    triggererEmail,
    body,
    labels,
    jira.defaultIssueTypes.task,
    repository,
    issueNumber.toString()
  );

  const updatedTitle = `${issue.key} - ${title}`;

  logger.debug(`Created Jira issue ${issue.key}, updating GitHub issue title`);

  await github.issues.update({
    owner: organization,
    repo: repository,
    issue_number: issueNumber,
    body,
    title: updatedTitle,
    state,
  });

  logger.info(`Successfully linked GitHub #${issueNumber} with Jira ${issue.key}`);
}

export async function handleEditedIssue(params: {
  clients: Clients;
  title: string;
  body: string;
  labels: string[];
  issueNumber: number;
  organization: string;
  repository: string;
  assignee: string | null;
}) {
  const { title, body, labels, issueNumber, assignee } = params;

  // Extract Jira key from title
  const match = reverse(title).match(ISSUE_KEY_REGEX);

  if (!match) {
    logger.debug(`No Jira issue key found in title for edited issue #${issueNumber}`);
    return false;
  }

  const jiraKey = reverse(match[0]);

  logger.debug(`Syncing updates from GitHub #${issueNumber} to Jira ${jiraKey}`);

  // Only sync if configured
  const updates: any = {};

  if (config.sync?.descriptions && body) {
    updates.description = body;
    logger.debug(`Updating description for ${jiraKey}`);
  }

  if (config.sync?.labels && labels) {
    // Filter out control labels
    const syncLabels = labels.filter(l => 
      l !== "source:github" && l !== "source:jira"
    );
    if (syncLabels.length > 0) {
      updates.labels = syncLabels;
      logger.debug(`Updating labels for ${jiraKey}`, { labels: syncLabels });
    }
  }

  if (config.sync?.assignees && assignee) {
    updates.assigneeEmail = assignee;
    logger.debug(`Updating assignee for ${jiraKey}`, { assignee });
  }

  if (Object.keys(updates).length > 0) {
    await jira.updateIssue({
      issueKey: jiraKey,
      ...updates,
    });

    logger.info(`Successfully synced updates from GitHub #${issueNumber} to Jira ${jiraKey}`);
    return true;
  }

  logger.debug(`No updates to sync for GitHub #${issueNumber}`);
  return false;
}

export async function handleClosedIssue(params: { title: string }) {
  const { title } = params;

  const match = reverse(title).match(ISSUE_KEY_REGEX);

  if (!match) {
    logger.debug(`No Jira issue key found in title: ${title}`);
    return false;
  }

  const jiraKey = reverse(match[0]);

  logger.debug(`Closing Jira issue ${jiraKey}`);

  await jira.closeIssue(jiraKey);

  logger.info(`Successfully closed Jira issue ${jiraKey}`);

  return true;
}

export async function handleIssueCommentCreation(params: {
  clients: Clients;
  title: string;
  body: string;
  commentId: number;
  owner: string;
  repository: string;
}) {
  const { clients, title, body, commentId, owner, repository } = params;

  if (
    body.includes(CONTROL_COMMENT_BODY.FROM_GITHUB) ||
    body.includes(CONTROL_COMMENT_BODY.FROM_JIRA)
  ) {
    logger.debug(`Comment ${commentId} is a sync comment, skipping`);
    return "conflict";
  }

  const match = reverse(title).match(ISSUE_KEY_REGEX);

  if (!match) {
    logger.debug(`No Jira issue key found in title for comment: ${title}`);
    return "unprocessableEntity";
  }

  const github = resolveGithubClient(clients);

  const customBody = `${body}\n\n${CONTROL_COMMENT_BODY.FROM_GITHUB} by ${owner}`;

  await github.issues.updateComment({
    owner,
    repo: repository,
    comment_id: commentId,
    body,
  });

  const jiraKey = reverse(match[0]);

  logger.debug(`Syncing comment to Jira issue ${jiraKey}`);

  await jira.commentIssue({
    issueKey: jiraKey,
    body: customBody,
  });

  logger.info(`Successfully synced comment to Jira issue ${jiraKey}`);

  return "success";
}
