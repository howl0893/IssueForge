# Migration Guide: Octosync 1.0 → 2.0

This guide helps you migrate from the original Octosync to the enhanced 2.0 version.

## What's Changed

### Major Improvements
1. **Configuration System** - YAML config files with backward compatibility
2. **Enhanced Logging** - Structured logging with Winston
3. **Retry Logic** - Automatic retries with exponential backoff
4. **Extended Sync** - Descriptions, labels, and more sync bidirectionally
5. **Modern Stack** - TypeScript 5.x, updated dependencies

### Breaking Changes
⚠️ **None!** - Octosync 2.0 is fully backward compatible with 1.0 environment variables.

## Migration Steps

### Option 1: Keep Using Environment Variables (No Changes Required)

Your existing `.env` file or environment variables will continue to work:

```bash
# Your existing configuration still works!
NODE_ENV=production
GITHUB_TOKEN=your-token
GITHUB_ORGANIZATION=your-org
GITHUB_REPOSITORY=your-repo
JIRA_HOST=https://your-company.atlassian.net
JIRA_API_TOKEN=your-jira-token
JIRA_ISSUER_EMAIL=your-email@example.com
JIRA_PROJECT=PROJ
JIRA_PROJECT_ID=10000
JIRA_DONE_TRANSITION_ID=41
JIRA_DONE_STATUS_NAME=Done
JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD=10035
JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD=10036
```

### Option 2: Migrate to YAML Configuration (Recommended)

For better maintainability, create a `config.yaml`:

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

# New: Configure what gets synced
sync:
  descriptions: true
  labels: true
  assignees: true
  attachments: false
  comments: true

# New: Retry configuration
retry:
  maxAttempts: 3
  initialDelay: 1000

server:
  port: 8000
  nodeEnv: "production"
```

## Deployment Migration

### Docker

#### Old Way (Still Works)
```bash
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  ghcr.io/marcelovicentegc/octosync:latest
```

#### New Way (Recommended)
```bash
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -v $(pwd)/logs:/app/logs \
  ghcr.io/marcelovicentegc/octosync:latest
```

### Docker Compose (New)

Create `docker-compose.yaml`:

```yaml
version: '3.8'

services:
  octosync:
    image: ghcr.io/marcelovicentegc/octosync:latest
    ports:
      - "8000:8000"
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./logs:/app/logs
    restart: unless-stopped
```

Then run:
```bash
docker-compose up -d
```

## New Features to Enable

### 1. Enhanced Logging

Logs are now written to `logs/` directory:
- `combined.log` - All logs
- `error.log` - Errors only
- `exceptions.log` - Uncaught exceptions

Make sure to mount the logs volume:
```bash
-v $(pwd)/logs:/app/logs
```

### 2. Bidirectional Description Sync

Now enabled by default! When you edit an issue description:
- GitHub → Jira: Description updates automatically
- Jira → GitHub: Body/description updates automatically

Configure via:
```yaml
sync:
  descriptions: true  # Default: true
```

### 3. Bidirectional Label Sync

Labels now sync on updates:
- GitHub → Jira: Labels update in Jira
- Jira → GitHub: Labels update in GitHub

Configure via:
```yaml
sync:
  labels: true  # Default: true
```

### 4. Health Check Endpoint

New endpoint for monitoring:
```bash
curl http://localhost:8000/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-02-07T05:00:00.000Z",
  "version": "2.0.0"
}
```

## Webhook Configuration

### GitHub Webhooks

**No changes required!** But you can now add the "edited" event for better sync:

Navigate to: `https://github.com/{ORG}/{REPO}/settings/hooks`

Events to enable:
- ✅ Issues
- ✅ Issue comments
- ✅ Labels

### Jira Webhooks

**No changes required!** The existing webhook configuration continues to work.

Navigate to: `{JIRA_HOST}/plugins/servlet/webhooks`

Events to enable:
- Issue: ✅ created, ✅ updated, ✅ deleted
- Comment: ✅ created

## Testing Your Migration

1. **Check Server Starts**
   ```bash
   docker logs octosync
   ```
   
   Look for:
   ```
   Octosync server listening on 172.x.x.x:8000
   ```

2. **Test Health Check**
   ```bash
   curl http://localhost:8000/health
   ```

3. **Test Issue Creation**
   - Create an issue on GitHub → Check Jira
   - Create an issue on Jira → Check GitHub

4. **Test Issue Updates** (New!)
   - Edit issue description on GitHub → Check Jira
   - Edit issue description on Jira → Check GitHub
   - Add/remove labels → Check both sides

## Troubleshooting

### Issue: "Cannot find config file"
**Solution**: Either:
- Create `config.yaml` in the working directory, OR
- Use environment variables (backward compatible)

### Issue: "Logs directory not found"
**Solution**: Create logs directory or mount volume:
```bash
mkdir logs
# OR in docker-compose
volumes:
  - ./logs:/app/logs
```

### Issue: "Webhook returns 409 Conflict"
**Status**: Expected behavior (loop prevention)
**Explanation**: Issue already has a control label (source:github or source:jira)

### Issue: Build fails after upgrade
**Solution**: 
```bash
yarn install
yarn build
```

## Rollback Plan

If you need to rollback:

1. **Docker**: Use the old image tag
   ```bash
   docker pull ghcr.io/marcelovicentegc/octosync:1.0.0
   ```

2. **Source**: Checkout the original commit
   ```bash
   git checkout v1.0.0
   yarn install
   yarn build
   ```

## Getting Help

- 📖 [README-2.0.md](README-2.0.md) - Full documentation
- 🐛 [GitHub Issues](https://github.com/howl0893/octosync-2.0/issues)
- 💬 Discussions - Ask questions in GitHub Discussions

## What's Next

Future enhancements coming:
- Attachment sync
- Custom field mapping
- Sync rules/filters
- Admin UI
- Queue system with BullMQ

See [README-2.0.md](README-2.0.md) for the full roadmap!
