import express from "express";
import cors from "cors";
import { getConfig, getLogger } from "@octosync/utils";
import { github } from "./github";
import { jira } from "./jira";
import { lookup } from "dns";
import { hostname } from "os";

const logger = getLogger();

export function startEventsServer() {
  const config = getConfig();
  const PORT = config.server?.port || 8000;
  const GITHUB_REPOSITORY = config.github.repository;
  const GITHUB_ORGANIZATION = config.github.organization;
  const JIRA_HOST = config.jira.host;

  let addr = "";

  lookup(hostname(), (_, address, __) => {
    addr = address;
  });

  logger.info(`
    ██████╗  ██████╗████████╗ ██████╗ ███████╗██╗   ██╗███╗   ██╗ ██████╗
    ██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
    ██║   ██║██║        ██║   ██║   ██║███████╗ ╚████╔╝ ██╔██╗ ██║██║     
    ██║   ██║██║        ██║   ██║   ██║╚════██║  ╚██╔╝  ██║╚██╗██║██║     
    ╚██████╔╝╚██████╗   ██║   ╚██████╔╝███████║   ██║   ██║ ╚████║╚██████╗
     ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝
  `);

  logger.info(`Make sure your Github webhook endpoint is configured @ https://github.com/${GITHUB_ORGANIZATION}/${GITHUB_REPOSITORY}/settings/hooks`);
  logger.info(`Make sure your Jira webhook endpoint is configured @ ${JIRA_HOST}/plugins/servlet/webhooks`);

  const server = express();

  server.use(cors());
  server.use(express.json());
  server.use(express.urlencoded({ extended: true }));

  server.use(github);
  server.use(jira);

  server.get("/", async (_, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json("OK");

    return res;
  });

  server.get("/health", async (_, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ 
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "2.0.0"
    });

    return res;
  });

  server.use((_, res) => {
    res.status(404).end("Not Found");
    return res;
  });

  server.listen(PORT, () => {
    logger.info(`Octosync server listening on ${addr}:${PORT}`);
  });
}
