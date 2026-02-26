export interface IssuePayload {
  action: "opened" | "assigned" | "labeled" | "closed" | "edited" | "created" | "deleted" | "unlabeled" | "unassigned";
  issue: {
    url: string;
    repository_url: string;
    comments_url: string;
    id: number;
    /**
     * Issue's number
     */
    number: number;
    /**
     * Issue's title
     */
    title: string;
    /**
     * Issue's body
     */
    body: string;
    user: {
      /**
       * Trigerrer github name
       */
      login: string;
      avatar_url: string;
      site_admin: boolean;
    };
    labels: IssueLabel[];
    state: "open" | string;
    locked: boolean;
    assignee: null | {
      /**
       * Assignee github name
       */
      login: string;
      avatar_url: string;
      site_admin: boolean;
    };
    assignees: Array<{
      login: string;
      avatar_url: string;
      site_admin: boolean;
    }>;
    comments: number;
    created_at: string;
    updated_at: string;
    closed_at: null | string;
    author_association: "COLLABORATOR" | string;
  };
  label?: IssueLabel;
  assignee?: {
    login: string;
    avatar_url: string;
    site_admin: boolean;
  };
  changes?: {
    title?: {
      from: string;
    };
    body?: {
      from: string;
    };
  };
  comment: {
    url: string;
    html_url: string;
    issue_url: string;
    id: number;
    node_id: string;
    user: {
      login: string;
      avatar_url: string;
      site_admin: boolean;
    };
    created_at: string;
    updated_at: string;
    author_association: "OWNER" | string;
    body: string;
  };
  repository: {
    name: string;
    /**
     * owner/repo format
     */
    full_name: string;
    private: boolean;
    html_url: string;
    description: string;
    fork: boolean;
    url: string;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    homepage: string;
    archived: boolean;
    disabled: boolean;
    open_issues_count: number;
    forks: number;
    open_issues: number;
    watchers: number;
    default_branch: string;
    owner: {
      /**
       * Org name
       */
      login: string;
      url: string;
      description: string;
    };
  };
  sender: {
    /**
     * Trigerrer github name
     */
    login: string;
    avatar_url: string;
    type: "User" | string;
    site_admin: boolean;
  };
}

export interface IssueLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string;
}
