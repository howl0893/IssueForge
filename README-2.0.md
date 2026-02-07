# Octosync 2.0 - Enhanced Edition

[![License: MIT](https://img.shields.io/github/license/marcelovicentegc/octosync)](LICENSE)
[![Build](https://github.com/marcelovicentegc/octosync/actions/workflows/build.yml/badge.svg)](https://github.com/marcelovicentegc/octosync/actions/workflows/build.yml)

<p align="center">
  <img alt="octosync logo" src="https://raw.githubusercontent.com/marcelovicentegc/octosync/main/assets/octosync.png" height="300" />
  <h3 align="center">octosync 2.0</h3>
  <p align="center">A robust, open-source solution to keep GitHub and Jira issues synchronized. A free alternative to Exalate and Unito.</p>
</p>

---

## 🚀 What's New in 2.0

Octosync 2.0 significantly enhances the original project with Exalate-like capabilities:

### Infrastructure Improvements
- ✅ **YAML Configuration** - Move beyond environment variables with structured config files
- ✅ **Advanced Logging** - Winston-based logging with file rotation and structured output
- ✅ **Retry Logic** - Automatic retries with exponential backoff for API failures
- ✅ **Health Checks** - Built-in health check endpoint for monitoring
- ✅ **Docker Compose** - Easy deployment with Redis for future queuing support

### Enhanced Sync Capabilities
- ✅ **Extended Client Support** - Enhanced GitHub and Jira clients support labels, assignees
- 🚧 **Bidirectional Description Sync** - Sync issue bodies/descriptions on updates
- 🚧 **Label Mapping** - Sync labels between GitHub and Jira
- 🚧 **Assignee Sync** - Keep assignees in sync across platforms
- 🚧 **Attachment Support** - Bidirectional file attachment sync
- 🚧 **Custom Field Mapping** - Map Jira custom fields to GitHub

### Modern Stack
- TypeScript 5.x
- Latest Octokit for GitHub
- Zod for configuration validation
- Winston for structured logging
- p-retry for resilient API calls

---

## Features

### Current Capabilities
- ✅ Sync issue creation bi-directionally
- ✅ Sync issue closing bi-directionally  
- ✅ Sync issue comments bi-directionally
- ✅ Automatic retry on API failures
- ✅ Structured logging with file output
- ✅ Health check endpoint
- ✅ Docker Compose deployment

### Roadmap (In Progress)
- 🚧 Sync descriptions/body on updates
- 🚧 Sync labels bidirectionally
- 🚧 Sync assignees bidirectionally
- 🚧 Sync attachments
- 🚧 Configurable status mappings
- 🚧 Sync rules and filters (include/exclude by labels, JQL)
- 🚧 Custom field transformations
- 🚧 Queue system with BullMQ/Redis
- 🚧 Admin UI for configuration

---

## Installation

### Prerequisites
- Node.js 14+ (tested with Node 24.x)
- Docker (for containerized deployment)
- GitHub Personal Access Token
- Jira API Token and Account

### Configuration

Octosync 2.0 supports two configuration methods:

#### Option 1: YAML Configuration File (Recommended)

Create a `config.yaml` file (see [config.example.yaml](config.example.yaml)):

```yaml
github:
  token: "your-github-token"
  organization: "your-org"
  repository: "your-repo"

jira:
  host: "https://your-company.atlassian.net"
  apiToken: "your-jira-token"
  issuerEmail: "your-email@example.com"
  project: "PROJ"
  projectId: "10000"
  doneTransitionId: "41"
  doneStatusName: "Done"
  customFields:
    githubRepository: "10035"
    githubIssueNumber: "10036"

sync:
  descriptions: true
  labels: true
  assignees: true
  attachments: false
  comments: true

retry:
  maxAttempts: 3
  initialDelay: 1000

server:
  port: 8000
  nodeEnv: "production"
```

#### Option 2: Environment Variables (Legacy)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (production/development) | `development` |
| `PORT` | Server port | `8000` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | - |
| `GITHUB_ORGANIZATION` | GitHub organization or username | - |
| `GITHUB_REPOSITORY` | Repository name | - |
| `JIRA_HOST` | Jira host URL | - |
| `JIRA_API_TOKEN` | Jira API token | - |
| `JIRA_ISSUER_EMAIL` | Jira account email | - |
| `JIRA_PROJECT` | Jira project key | - |
| `JIRA_PROJECT_ID` | Jira project ID | - |
| `JIRA_DONE_TRANSITION_ID` | Transition ID for "Done" | `41` |
| `JIRA_DONE_STATUS_NAME` | Name of "Done" status | `Done` |
| `JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD` | Custom field ID for repo | - |
| `JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD` | Custom field ID for issue # | - |

### Deployment Methods

#### Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/howl0893/octosync-2.0.git
cd octosync-2.0

# 2. Copy and configure
cp config.example.yaml config.yaml
# Edit config.yaml with your credentials

# 3. Build and start
docker-compose up -d
```

#### Docker (Single Container)

```bash
# Pull image
docker pull ghcr.io/marcelovicentegc/octosync:latest

# Run with config file
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -v $(pwd)/logs:/app/logs \
  ghcr.io/marcelovicentegc/octosync:latest

# OR run with environment variables
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  ghcr.io/marcelovicentegc/octosync:latest
```

#### Local Development

```bash
# 1. Install dependencies
yarn install

# 2. Build packages
yarn build

# 3. Configure
cp config.example.yaml config.yaml
# Edit config.yaml

# 4. Start server
yarn start:webhooks
```

---

## Webhook Configuration

### GitHub Webhook

Navigate to: `https://github.com/{ORGANIZATION}/{REPOSITORY}/settings/hooks`

- **Payload URL**: `https://your-domain.com/github`
- **Content type**: `application/json`
- **Events**: Select individual events
  - ✅ Issues
  - ✅ Issue comments
  - ✅ Labels

### Jira Webhook

Navigate to: `{JIRA_HOST}/plugins/servlet/webhooks`

- **URL**: `https://your-domain.com/jira`
- **Events**:
  - Issue: ✅ created, ✅ updated, ✅ deleted
  - Comment: ✅ created

---

## Architecture

### Packages

- **`@octosync/webhooks`** - Express server handling webhook events
- **`@octosync/handlers`** - Business logic for sync operations
- **`@octosync/clients`** - GitHub (Octokit) and Jira API clients
- **`@octosync/utils`** - Shared utilities (config, logging, retry)
- **`@octosync/bot`** - Probot-based GitHub App (alternative deployment)

### Sync Flow

```
GitHub Event → Webhook Handler → Handler (with retry) → Jira API
     ↑                                                       ↓
     └──────────────← Jira Webhook ← Jira Event ←──────────┘
```

### Loop Prevention

Octosync uses control labels and comment markers:
- GitHub → Jira: Adds `source:github` label
- Jira → GitHub: Adds `source:jira` label
- Comments include markers: `**COMMENT FROM GITHUB**` / `**COMMENT FROM JIRA**`

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check (returns "OK") |
| `/health` | GET | Detailed health status with timestamp |
| `/github` | POST | GitHub webhook receiver |
| `/jira` | POST | Jira webhook receiver |

---

## Logging

Logs are stored in the `logs/` directory:

- `combined.log` - All log entries
- `error.log` - Error-level logs only
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

Log format: `YYYY-MM-DD HH:mm:ss [level]: message {metadata}`

---

## Troubleshooting

### Common Issues

**Issue: Webhook returns 409 Conflict**
- This is expected - it prevents infinite sync loops
- The issue already has a control label (source:github or source:jira)

**Issue: Webhook returns 422 Unprocessable Entity**
- Cannot find Jira issue key in GitHub issue title
- Ensure issues are properly linked before closing

**Issue: Build fails with TypeScript errors**
- Ensure you're using Node.js 14+
- Run `yarn install` and `yarn build`

**Issue: Docker container exits immediately**
- Check configuration is valid
- View logs: `docker-compose logs octosync`

---

## Comparison to Exalate

| Feature | Octosync 2.0 | Exalate |
|---------|--------------|---------|
| Price | Free (Open Source) | Paid (starts $59/month) |
| Basic Sync (issues, comments) | ✅ | ✅ |
| Labels Sync | 🚧 In Progress | ✅ |
| Assignees Sync | 🚧 In Progress | ✅ |
| Attachments | 🚧 In Progress | ✅ |
| Custom Fields | 🚧 Planned | ✅ |
| Status Mapping | 🚧 In Progress | ✅ |
| Transformations | 🚧 Planned | ✅ |
| Sync Rules/Filters | 🚧 Planned | ✅ |
| Admin UI | 🚧 Planned | ✅ |
| Self-Hosted | ✅ | ❌ (Cloud only) |
| Open Source | ✅ | ❌ |

---

## Contributing

Contributions are welcome! This is an active enhancement project.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Development

```bash
# Clone and install
git clone https://github.com/howl0893/octosync-2.0.git
cd octosync-2.0
yarn install

# Build all packages
yarn build

# Start in development mode
yarn start:webhooks

# Run tests (when available)
yarn test
```

---

## License

MIT © [Marcelo Cardoso](https://github.com/marcelovicentegc)

Enhanced by the community to provide a free, open-source alternative to commercial sync solutions.

---

## Acknowledgments

- Original project: [marcelovicentegc/octosync](https://github.com/marcelovicentegc/octosync)
- Inspired by Exalate's powerful sync capabilities
- Built with ❤️ for the open-source community
