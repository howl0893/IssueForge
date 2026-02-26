[![License: ISC](https://img.shields.io/badge/ISC-license-green)](LICENSE)
[![Build](https://github.com/howl0893/IssueForge/actions/workflows/build.yml/badge.svg)](https://github.com/howl0893/IssueForge/actions/workflows/build.yml)

<p align="center">
  <img alt="IssueForge logo" src="https://raw.githubusercontent.com/howl0893/IssueForge/main/assets/IssueForge.png" height="300" />
  <h3 align="center">@IssueForge/bot</h3>
  <p align="center">IssueForge Bot keeps Github and Jira issues in sync.</p>
</p>

---

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t IssueForge-bot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> IssueForge-bot
```

## Contributing

If you have suggestions for how `@IssueForge/bot` could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2021 Matthew Howlett <mhowlett@applied-ml.dev>
