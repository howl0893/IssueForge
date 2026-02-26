# Copilot Instructions for IssueForge

## Build, Test, and Lint Commands

- **Install dependencies:**
  - `yarn install` (root)
- **Build all packages:**
  - `yarn build` (root)
  - `lerna run build` (root)
- **Build individual package:**
  - `yarn workspace <package> build` (e.g., `yarn workspace @IssueForge/webhooks build`)
- **Start webhooks service:**
  - `yarn start:webhooks` (root)
  - `yarn workspace @IssueForge/webhooks start`
  - Production: `yarn start:webhooks:prod` (root)
- **Start bot service:**
  - `yarn start:bot` (root)
  - `yarn workspace @IssueForge/bot start`
- **Expose local server for webhook testing:**
  - `yarn start:expose` (root)
- **Run tests (bot package):**
  - `yarn workspace @IssueForge/bot test`
  - Run a single test: Use Jest's `--testNamePattern` or `--runTestsByPath` options
- **Linting:**
  - No explicit lint command found; check package scripts for updates

## High-Level Architecture

- **Monorepo structure** managed by Lerna and Yarn workspaces.
- **Core packages:**
  - `bot`: Probot-based bot for syncing GitHub and Jira issues
  - `webhooks`: Handles webhook events and synchronization logic
  - `handlers`: Business logic for issue and comment sync
  - `clients`: API clients for GitHub/Jira
  - `db`: SQLite-based mapping and persistence layer
  - `utils`: Shared utilities
- **Synchronization:**
  - Bi-directional sync for issues and comments between GitHub and Jira
  - Uses structured logging, error handling, and infinite loop prevention
- **Deployment:**
  - Docker support for both root and bot package
  - `docker-compose.yml` for local orchestration

## Key Conventions

- **TypeScript:** All packages use TypeScript; build with `tsc`
- **Structured logging:** Timestamps and context included
- **Infinite loop prevention:** Control labels and comment markers
- **User mapping:** Assignee sync uses explicit user mapping
- **Error handling:** Robust error logs for failures
- **Database:** SQLite for mapping comment/user IDs
- **Branching:** Create feature branches for PRs; follow commit message conventions

## Integration with Other AI Assistant Configs

- No other AI assistant config files detected (Claude, Cursor, Codex, Windsurf, Aider, Cline)

---

This file summarizes build/test commands, architecture, and conventions for Copilot. Would you like to adjust anything or add coverage for areas I may have missed? If you want to configure MCP servers (e.g., Playwright for web projects), let me know.
