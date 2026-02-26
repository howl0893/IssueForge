import { handleAxiosError, useEnv, logger } from "@IssueForge/utils";
import { CreateIssue, User } from "./types";
import { jira } from "./singleton";

export class Jira {
  private host: string;
  private project: string;
  private projectId: string;
  public defaultIssueTypes = {
    epic: "10000",
    story: "10001",
    task: "10002",
    subTask: "10003",
    bug: "10004",
  };

  private async getUserAccountId(email: string) {
    try {
      const users: User[] = await jira.userSearch.findUsers({
        query: email,
      });

      // Handle case where no users are found
      if (!users || users.length === 0) {
        logger.warn(`No Jira user found for email: ${email}`, {
          context: "JiraClient",
        });
        return null;
      }

      return users[0].accountId;
    } catch (err) {
      logger.error(`Error finding Jira user for email: ${email}`, {
        context: "JiraClient",
        data: err,
      });
      return null;
    }
  }

  public constructor(host: string, project: string, projectId: string) {
    this.host = host;
    this.project = project;
    this.projectId = projectId;
  }

  public async createJiraIssue(
    title: string,
    email: string,
    description: string,
    labels: string[],
    issueTypeId?: string,
    repository?: string,
    issueNumber?: string
  ) {
    try {
      const {
        JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD,
        JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD,
      } = useEnv();

      // Use provided issueTypeId, fallback to env var, then default
      const finalIssueTypeId = issueTypeId || 
        process.env.JIRA_DEFAULT_ISSUE_TYPE_ID || 
        this.defaultIssueTypes.task;

      let ticket: CreateIssue = {
        fields: {
          project: { id: this.projectId },
          summary: title,
          description,
          issuetype: { id: finalIssueTypeId },
          labels,
          assignee: {
            id: undefined,
          },
          [JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD]: issueNumber ? Number(issueNumber) : undefined,
          [JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD]: repository,
        },
      };

      const accountId = await this.getUserAccountId(email);

      if (accountId) {
        ticket.fields.assignee!.id = accountId;
      }

      const createdIssue = await jira.issues.createIssue(ticket);
      
      logger.success(`Created Jira issue: ${createdIssue.key}`, {
        context: "JiraClient",
        data: { issueKey: createdIssue.key, issueTypeId: finalIssueTypeId },
      });
      
      return createdIssue;
    } catch (error) {
      handleAxiosError(error);
      throw error;
    }
  }

  public async updateIssueWithGithubData(params: {
    issueKey: string;
    repository: string;
    issueNumber: string;
  }) {
    const { issueKey, repository, issueNumber } = params;

    const {
      JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD,
      JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD,
    } = useEnv();

    try {
      await jira.issues.editIssue({
        issueIdOrKey: issueKey,
        fields: {
          [JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD]: issueNumber,
          [JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD]: repository,
        },
      });
    } catch (error) {
      handleAxiosError(error);
      throw error;
    }
  }

  public async commentIssue(params: { issueKey: string; body: string }): Promise<string> {
    const { issueKey, body } = params;

    try {
      const comment: any = await jira.issues.addComment({
        issueIdOrKey: issueKey,
        body,
      });
      
      logger.info(`Added comment to Jira issue ${issueKey}`, {
        context: "JiraClient",
        data: { commentId: comment.id },
      });

      return comment.id;
    } catch (error) {
      handleAxiosError(error);
      throw error;
    }
  }

  public async closeIssue(issueKey: string) {
    const { JIRA_DONE_TRANSITION_ID } = useEnv();

    try {
      await jira.issues.doTransition({
        issueIdOrKey: issueKey,
        transition: {
          id: JIRA_DONE_TRANSITION_ID,
        },
      });
      
      logger.info(`Transitioned Jira issue ${issueKey} to Done (transition ID: ${JIRA_DONE_TRANSITION_ID})`, {
        context: "JiraClient",
      });
    } catch (error) {
      handleAxiosError(error);
    }
  }

  public async deleteIssue(issueKey: string) {
    try {
      await jira.issues.deleteIssue({
        issueIdOrKey: issueKey,
      });
      
      logger.warn(`Deleted Jira issue ${issueKey}`, {
        context: "JiraClient",
      });
    } catch (error) {
      handleAxiosError(error);
      throw error;
    }
  }

  public async getIssue(issueKey: string) {
    try {
      return await jira.issues.getIssue({
        issueIdOrKey: issueKey,
      });
    } catch (error) {
      handleAxiosError(error);
    }
  }

  public async findIssueByGitHubData(params: {
    repository: string;
    issueNumber: number;
  }): Promise<string | null> {
    const {
      JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD,
      JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD,
    } = useEnv();

    try {
      const jql = `project = "${this.project}" AND "${JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD}" ~ "${params.repository}" AND "${JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD}" = ${params.issueNumber}`;
      
      const results: any = await jira.sendRequest(
        {
          url: "/rest/api/2/search",
          method: "GET",
          params: {
            jql,
            maxResults: 1,
          },
        },
        undefined as never
      );

      if (results.issues && results.issues.length > 0) {
        const issueKey = results.issues[0].key;
        logger.info(`Found Jira issue ${issueKey} for GitHub ${params.repository}#${params.issueNumber}`, {
          context: "JiraClient",
        });
        return issueKey;
      }

      logger.warn(`No Jira issue found for GitHub ${params.repository}#${params.issueNumber}`, {
        context: "JiraClient",
      });
      return null;
    } catch (error) {
      handleAxiosError(error);
      return null;
    }
  }

  public async updateIssue(params: {
    issueKey: string;
    summary?: string;
    description?: string;
    labels?: string[];
    assignee?: { accountId: string } | null;
  }) {
    const { issueKey, summary, description, labels, assignee } = params;

    try {
      const fields: any = {};
      if (summary !== undefined) fields.summary = summary;
      if (description !== undefined) fields.description = description;
      if (labels !== undefined) fields.labels = labels;
      if (assignee !== undefined) fields.assignee = assignee;

      await jira.issues.editIssue({
        issueIdOrKey: issueKey,
        fields,
      });

      logger.success(`Updated Jira issue ${issueKey}`, {
        context: "JiraClient",
        data: { updatedFields: Object.keys(fields) },
      });
    } catch (error) {
      handleAxiosError(error);
      throw error;
    }
  }

  public async updateComment(commentId: string, body: string) {
    try {
      await jira.sendRequest(
        {
          url: `/rest/api/2/comment/${commentId}`,
          method: "PUT",
          data: { body },
        },
        undefined as never
      );

      logger.success(`Updated Jira comment ${commentId}`, {
        context: "JiraClient",
      });
    } catch (error) {
      handleAxiosError(error);
      throw error;
    }
  }

  public async deleteComment(issueKey: string, commentId: string) {
    try {
      await jira.sendRequest(
        {
          url: `/rest/api/2/issue/${issueKey}/comment/${commentId}`,
          method: "DELETE",
        },
        undefined as never
      );

      logger.success(`Deleted Jira comment ${commentId} from issue ${issueKey}`, {
        context: "JiraClient",
      });
    } catch (error) {
      handleAxiosError(error);
      throw error;
    }
  }

  public async buildIssueUrl(issueKey: string) {
    try {
      return `https://${this.host}/jira/software/projects/${this.project}/issues/${issueKey}`;
    } catch (err) {
      throw err;
    }
  }
}
