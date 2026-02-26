[![License: MIT](https://img.shields.io/github/license/howl0893/IssueForge)](LICENSE)
[![Build](https://github.com/howl0893/IssueForge/actions/workflows/build.yml/badge.svg)](https://github.com/howl0893/IssueForge/actions/workflows/build.yml)

<p align="center">
  <img alt="IssueForge logo" src="./assets/issue-forge.png" height="500" />
  <h3 align="center">IssueForge</h3>
  <p align="center">An open-source solution to keep Github and Jira issues synchronized. An alternative to Exalate and Unito. Forked from
  <a href="https://github.com/howl0893/IssueForge.git">IssueForge</a>
  </p>
</p>

---

## Features

### Issue Synchronization
- ✅ **Create** - Sync issue creation bi-directionally (GitHub ↔ Jira)
- ✅ **Close** - Sync issue closing bi-directionally (GitHub issue close → Jira "Done" status, Jira "Done" → GitHub close)
- ✅ **Delete** - Sync issue deletion bi-directionally (GitHub deletion → Jira deletion, Jira deletion → GitHub close with notification)
- ✅ **Edit Title/Summary** - Sync issue title/summary changes bi-directionally
- ✅ **Edit Description** - Sync issue description changes bi-directionally
- ✅ **Labels** - Sync labels after issue creation (add/remove labels bi-directionally)
- ✅ **Assignees** - Sync assignee changes bi-directionally (with user mapping)

### Comment Synchronization
- ✅ **Create** - Sync comment creation bi-directionally
- ✅ **Edit** - Sync comment edits bi-directionally
- ✅ **Delete** - Sync comment deletions bi-directionally

### Additional Features
- ✅ Comprehensive structured logging with timestamps and context
- ✅ SQLite database for tracking comment and user ID mappings
- ✅ Infinite loop prevention with control labels and comment markers
- ✅ Robust error handling with detailed error logs

## Packages

- [bot](https://github.com/howl0893/IssueForge/tree/main/packages/bot)
- [clients](https://github.com/howl0893/IssueForge/tree/main/packages/clients)
- [handlers](https://github.com/howl0893/IssueForge/tree/main/packages/handlers)
- [utils](https://github.com/howl0893/IssueForge/tree/main/packages/utils)
- [webhooks](https://github.com/howl0893/IssueForge/tree/main/packages/webhooks)

## Installation

Currently, there is only one way to run IssueForge, which is through its [Docker image containing both Jira and Github webhooks servers](#docker-image-with-github-and-jira-webhooks-servers).

**Requirements:** Docker with Node 20-alpine base image

[The configuration below](#configuration) is valid for both of the aforementioned methods.

### Configuration

| Variable                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Defaults to   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| NODE_ENV                              | Whether you're running on a `production` or `development` environment. Set this to `production` when deploying IssueForge to an actual host.                                                                                                                                                                                                                                                                                                                                                                                                           | `development` |
| PORT                                  | The port which IssueForge should run. This variable only takes effect when developing locally, and NODE_ENV is set to `development`. Otherwise, it's set to `8000`, which is the port it runs on the docker image.                                                                                                                                                                                                                                                                                                                                     | `8000`        |
| GITHUB_TOKEN                          | An alternative to using passwords for authentication to GitHub when using the GitHub API or the command line. For more information on how to get this, see [Creating a personal access token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token).                                                                                                                                                                                                                                                          | -             |
| GITHUB_ORGANIZATION                   | Is your project hosted under your organization? If yes, use the organization name. Otherwise, use your Github usernamename.                                                                                                                                                                                                                                                                                                                                                                                                                          | -             |
| GITHUB_REPOSITORY                     | The repository name of the repository which you'd like to sync issues with.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | -             |
| JIRA_HOST                             | The Jira's host of the project you'd like to sync issues with. For example, mine is `https://howl0893.atlassian.net/`.                                                                                                                                                                                                                                                                                                                                                                                                                       | -             |
| JIRA_API_TOKEN                        | An API token to authenticate a script or other process (in this case, IssueForge) with an Atlassian cloud product. For more information on how to get this, see [Manage API tokens for your Atlassian account](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).                                                                                                                                                                                                                                    | -             |
| JIRA_ISSUER_EMAIL                     | You'll need an account to act in name of IssueForge, by syncing Github events. This is where its email goes.                                                                                                                                                                                                                                                                                                                                                                                                                                           | -             |
| JIRA_PROJECT                          | The project key of your project on Jira. To give you an example, IssueForge's project key on Jira is `OCT` - [see its prefix on the Github messages](https://github.com/howl0893/IssueForge/issues?q=is%3Aissue+is%3Aclosed).                                                                                                                                                                                                                                                                                                                    | -             |
| JIRA_PROJECT_ID                       | The ID of your project. It sucks, but you'll need to get this from a querystring on Jira. See the following for more information on how to get these: [Solved: JIRA Project ID](https://community.atlassian.com/t5/Jira-questions/JIRA-Project-ID/qaq-p/193094), [How to get project id from the Jira User Interface](https://confluence.atlassian.com/jirakb/how-to-get-project-id-from-the-jira-user-interface-827341414.html).                                                                                                                    | -             |
| JIRA_DONE_TRANSITION_ID               | The transition ID of the "Done", or the state which represents that a issue is completed/closed. For more information on how to get this, see [How to find transition ID?](https://community.atlassian.com/t5/Jira-questions/How-to-fine-transition-ID-of-JIRA/qaq-p/1207483#:~:text=Go%20to%20you%20Project%20Workflow,see%20transition%20id's%20for%20transitions.). In my case, I navigated to {{ JIRA_HOST }}/secure/admin/workflows/ListWorkflows.jspa and clicked on edit on the transition I needed to see the transition ID.                 | -             |
| JIRA_DONE_STATUS_NAME                 | The name of the transition above 👆.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -             |
| JIRA_DEFAULT_ISSUE_TYPE_ID            | The issue type ID for creating issues in your Jira project (e.g., Task, Story, Bug). Each Jira instance has different IDs. Get this from the Jira API: `curl -u email@example.com:api_token https://your-domain.atlassian.net/rest/api/3/issue/createmeta?projectKeys=YOUR_PROJECT` and look for the `id` field under `issuetypes`.                                                                                                                                                                                                                 | -             |
| JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD   | In order for Jira to figure out what is the repository linked to the project. We need to create custom fields on Jira, which will be filled by Github. For more information on how to create custom fields, see: [Create a custom field](https://support.atlassian.com/jira-cloud-administration/docs/create-a-custom-field). After creating the custom field, get its ID. For more on how to get a custom field ID, see: [How to find out field id?](https://community.atlassian.com/t5/Jira-Core-questions/How-to-find-out-field-id/qaq-p/140555). | -             |
| JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD | Repeat the above steps 👆.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | -             |

### Docker image with Github and Jira webhooks servers

The directions below go as far as getting IssueForge up and running on a host machine. Configuring a host machine and setting up any kind of proxy to make IssueForge available to the world is beyond the scope of this document.

The above is also valid for how to get the ID of custom Jira fields, transition IDs and so on. I'm leaving some links that might be helpful, on the table below.

Once you have gotten the [configuration variables needed](#configuration), it's time to set the webhook triggerers on Github, and Jira. I'm assuming you already know where you'll be hosting IssueForge and what is its domain.

- To configure your Github project's webhooks, navigate to: `https://github.com/{{ GITHUB_ORGANIZATION }}/{{ GITHUB_REPOSITORY }}/settings/hooks`
- To configure your Jira's system webhooks, navigate to: `{{ JIRA_HOST }}/plugins/servlet/webhooks`

| Platform | Webhooks                                                                                                                                        | Endpoint               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Github   | Check the following triggerers: `issues`, `issue comments` and `labels`                                                                         | `<your-domain>/github` |
| Jira     | Check the following triggerers: Under the `Issue` column, check `created`, `updated` and `deleted`. Under the `Comment` column, check `created` | `<your-domain>/jira`   |

#### Spinning IssueForge

1. Clone this repository:
   ```bash
   git clone git@github.com:howl0893/IssueForge.git
   cd IssueForge-2.0
   ```

2. Create a `.env` file in the root directory:

   _.env_

   ```bash
   NODE_ENV=production
   GITHUB_TOKEN=
   GITHUB_ORGANIZATION=
   GITHUB_REPOSITORY=
   JIRA_HOST=
   JIRA_ISSUER_EMAIL=
   JIRA_PROJECT=
   JIRA_PROJECT_ID=
   JIRA_API_TOKEN=
   JIRA_DONE_TRANSITION_ID=
   JIRA_DONE_STATUS_NAME=
   JIRA_DEFAULT_ISSUE_TYPE_ID=
   JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD=
   JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD=
   ```

3. Build and start IssueForge:
   ```bash
   docker-compose up -d
   ```

4. View logs to verify it's running:
   ```bash
   docker-compose logs -f
   ```

5. To stop:
   ```bash
   docker-compose down
   ```

## Contributing and developing

1. Clone this repository: `git clone git@github.com:howl0893/IssueForge.git`
2. Install dependencies and bootstrap packages: `yarn && yarn build`
3. For local development with Docker Compose:
   - Copy `.env.example` to `.env` and fill in your credentials
   - Run `docker-compose up` to start the webhook server
   - Run `docker-compose logs -f` to view logs
4. Navigate to the packages you want to contribute with and take a look at their READMEs

### Local Development Tips

- Use `docker-compose up` to run with live logging
- Use `docker-compose build --no-cache` to rebuild after making changes
- Check logs with comprehensive context using the structured logger
- Test webhooks locally using [ngrok](https://ngrok.com/) to expose your local server
