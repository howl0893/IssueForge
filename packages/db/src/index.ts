
import Database from "better-sqlite3";
import path from "path";

export class SyncDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || path.join(process.cwd(), "IssueForge.db");
    // Log the resolved database path for debugging
    // eslint-disable-next-line no-console
    console.log(`[SyncDatabase] Using SQLite DB path: ${resolvedPath}`);
    this.db = new Database(resolvedPath);
    this.initializeTables();
  }

  private initializeTables() {
    // Table for mapping Jira issues to GitHub issues
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS issue_mappings (
        jira_issue_key TEXT PRIMARY KEY,
        github_repository TEXT NOT NULL,
        github_issue_number INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // ...existing code...
  }

  // ==================== Issue Mappings ====================
  public saveIssueMapping(params: {
    jiraIssueKey: string;
    githubRepository: string;
    githubIssueNumber: number;
  }) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO issue_mappings (jira_issue_key, github_repository, github_issue_number)
      VALUES (?, ?, ?)
    `);
    stmt.run(params.jiraIssueKey, params.githubRepository, params.githubIssueNumber);
  }

  public getGithubIssueMapping(jiraIssueKey: string): { githubRepository: string; githubIssueNumber: number } | null {
    const stmt = this.db.prepare(
      "SELECT github_repository, github_issue_number FROM issue_mappings WHERE jira_issue_key = ?"
    );
    const row = stmt.get(jiraIssueKey) as { github_repository: string; github_issue_number: number } | undefined;
    if (!row) return null;

    return { githubRepository: row.github_repository, githubIssueNumber: row.github_issue_number };
  }

  // ==================== Comment Mappings ====================

  public saveCommentMapping(params: {
    githubCommentId: number;
    jiraCommentId: string;
    githubIssueNumber: number;
    githubRepository: string;
    jiraIssueKey: string;
  }) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO comment_mappings 
      (github_comment_id, jira_comment_id, github_issue_number, github_repository, jira_issue_key)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      params.githubCommentId,
      params.jiraCommentId,
      params.githubIssueNumber,
      params.githubRepository,
      params.jiraIssueKey
    );
  }

  public getJiraCommentId(githubCommentId: number): string | null {
    const stmt = this.db.prepare(
      "SELECT jira_comment_id FROM comment_mappings WHERE github_comment_id = ?"
    );
    const row = stmt.get(githubCommentId) as { jira_comment_id: string } | undefined;
    return row ? row.jira_comment_id : null;
  }

  public getGithubCommentId(jiraCommentId: string): number | null {
    const stmt = this.db.prepare(
      "SELECT github_comment_id FROM comment_mappings WHERE jira_comment_id = ?"
    );
    const row = stmt.get(jiraCommentId) as { github_comment_id: number } | undefined;
    return row ? row.github_comment_id : null;
  }

  public deleteCommentMapping(githubCommentId: number) {
    const stmt = this.db.prepare(
      "DELETE FROM comment_mappings WHERE github_comment_id = ?"
    );
    stmt.run(githubCommentId);
  }

  public deleteCommentMappingByJiraId(jiraCommentId: string) {
    const stmt = this.db.prepare(
      "DELETE FROM comment_mappings WHERE jira_comment_id = ?"
    );
    stmt.run(jiraCommentId);
  }

  // ==================== User Mappings ====================

  public saveUserMapping(githubUsername: string, jiraAccountId: string) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_mappings 
      (github_username, jira_account_id, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(githubUsername, jiraAccountId);
  }

  public getJiraAccountId(githubUsername: string): string | null {
    const stmt = this.db.prepare(
      "SELECT jira_account_id FROM user_mappings WHERE github_username = ?"
    );
    const row = stmt.get(githubUsername) as { jira_account_id: string } | undefined;
    return row ? row.jira_account_id : null;
  }

  public getGithubUsername(jiraAccountId: string): string | null {
    const stmt = this.db.prepare(
      "SELECT github_username FROM user_mappings WHERE jira_account_id = ?"
    );
    const row = stmt.get(jiraAccountId) as { github_username: string } | undefined;
    return row ? row.github_username : null;
  }

  public close() {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: SyncDatabase | null = null;

export function initializeDatabase(dbPath?: string): SyncDatabase {
  if (!dbInstance) {
    dbInstance = new SyncDatabase(dbPath);
  }
  return dbInstance;
}

export function getDatabase(): SyncDatabase {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return dbInstance;
}

export const db = {
  initialize: initializeDatabase,
  get: getDatabase,
};
