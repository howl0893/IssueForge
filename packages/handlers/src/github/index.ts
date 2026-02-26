import { jira } from "@IssueForge/clients";
import { db } from "@IssueForge/db";
import {
  reverse,
  ISSUE_KEY_REGEX,
  CONTROL_COMMENT_BODY,
  logger,
} from "@IssueForge/utils";
import { Clients } from "../types";
import { resolveGithubClient } from "./utils";

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

  const issue = await jira.createJiraIssue(
    title,
    triggererEmail,
    body,
    labels,
    undefined,
    repository,
    issueNumber.toString()
  );

  logger.success(`Created Jira issue ${issue.key} for GitHub #${issueNumber}`, {
    context: "Handler",
  });

  const updatedTitle = `${issue.key} - ${title}`;

  await github.issues.update({
    owner: organization,
    repo: repository,
    issue_number: issueNumber,
    body,
    title: updatedTitle,
    state,
  });

  logger.info(`Updated GitHub #${issueNumber} title with Jira key: ${issue.key}`, {
    context: "Handler",
  });
}

export async function handleClosedIssue(params: {
  title: string;
  repository?: string;
  issueNumber?: number;
}) {
  const { title, repository, issueNumber } = params;

  const match = reverse(title).match(ISSUE_KEY_REGEX);

  let issueKey: string | null = null;

  if (match) {
    issueKey = reverse(match[0]);
  } else if (repository && issueNumber) {
    // Fallback: try to find Jira issue by GitHub custom fields
    logger.info(`Jira key not found in title, searching by custom fields`, {
      context: "Handler",
      data: { repository, issueNumber },
    });
    issueKey = await jira.findIssueByGitHubData({ repository, issueNumber });
  }

  if (!issueKey) {
    logger.warn(`Cannot close Jira issue - no Jira key found in title and custom field search failed`, {
      context: "Handler",
      data: { title, repository, issueNumber },
    });
    return false;
  }

  await jira.closeIssue(issueKey);

  logger.success(`Transitioned Jira issue ${issueKey} to Done`, {
    context: "Handler",
  });

  return true;
}

export async function handleIssueCommentCreation(params: {
  clients: Clients;
  title: string;
  body: string;
  commentId: number;
  owner: string;
  repository: string;
  issueNumber: number;
}) {
  const { clients, title, body, commentId, owner, repository, issueNumber } = params;

  if (
    body.includes(CONTROL_COMMENT_BODY.FROM_GITHUB) ||
    body.includes(CONTROL_COMMENT_BODY.FROM_JIRA)
  ) {
    return "conflict";
  }

  const match = reverse(title).match(ISSUE_KEY_REGEX);

  if (!match) {
    return "unprocessableEntity";
  }

  const issueKey = reverse(match[0]);
  const github = resolveGithubClient(clients);

  const customBody = `${body}\n\n${CONTROL_COMMENT_BODY.FROM_GITHUB}`;

  await github.issues.updateComment({
    owner,
    repo: repository,
    comment_id: commentId,
    body,
  });

  const jiraCommentId = await jira.commentIssue({
    issueKey,
    body: customBody,
  });

  // Store comment ID mapping
  db.get().saveCommentMapping({
    githubCommentId: commentId,
    jiraCommentId,
    githubIssueNumber: issueNumber,
    githubRepository: repository,
    jiraIssueKey: issueKey,
  });

  logger.success(`Synced comment to Jira issue ${issueKey}`, {
    context: "Handler",
  });

  return "success";
}
