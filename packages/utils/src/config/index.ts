import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { z } from "zod";

// Configuration schema
const StatusMappingSchema = z.record(z.string());

const SyncRulesSchema = z.object({
  includeLabels: z.array(z.string()).optional(),
  excludeLabels: z.array(z.string()).optional(),
  jqlFilter: z.string().optional(),
});

const ConfigSchema = z.object({
  github: z.object({
    token: z.string(),
    organization: z.string(),
    repository: z.string(),
  }),
  jira: z.object({
    host: z.string(),
    apiToken: z.string(),
    issuerEmail: z.string(),
    project: z.string(),
    projectId: z.string(),
    doneTransitionId: z.string().default("41"),
    doneStatusName: z.string().default("Done"),
    customFields: z.object({
      githubRepository: z.string(),
      githubIssueNumber: z.string(),
    }),
  }),
  sync: z.object({
    descriptions: z.boolean().default(true),
    labels: z.boolean().default(true),
    assignees: z.boolean().default(true),
    attachments: z.boolean().default(false),
    comments: z.boolean().default(true),
    statusMapping: StatusMappingSchema.optional(),
    rules: SyncRulesSchema.optional(),
  }).optional(),
  retry: z.object({
    maxAttempts: z.number().default(3),
    initialDelay: z.number().default(1000),
  }).optional(),
  server: z.object({
    port: z.number().default(8000),
    nodeEnv: z.string().default("development"),
  }).optional(),
});

export type OctosyncConfig = z.infer<typeof ConfigSchema>;

let cachedConfig: OctosyncConfig | null = null;

/**
 * Load configuration from YAML file or environment variables
 */
export function loadConfig(configPath?: string): OctosyncConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try to load from YAML file first
  if (configPath && fs.existsSync(configPath)) {
    try {
      const fileContents = fs.readFileSync(configPath, "utf8");
      const yamlConfig = yaml.load(fileContents);
      cachedConfig = ConfigSchema.parse(yamlConfig);
      return cachedConfig;
    } catch (error) {
      console.warn(`Failed to load config from ${configPath}:`, error);
      // Fall back to environment variables
    }
  }

  // Fall back to environment variables (backward compatibility)
  const envConfig = {
    github: {
      token: process.env.GITHUB_TOKEN || "",
      organization: process.env.GITHUB_ORGANIZATION || "",
      repository: process.env.GITHUB_REPOSITORY || "",
    },
    jira: {
      host: process.env.JIRA_HOST || "",
      apiToken: process.env.JIRA_API_TOKEN || "",
      issuerEmail: process.env.JIRA_ISSUER_EMAIL || "",
      project: process.env.JIRA_PROJECT || "",
      projectId: process.env.JIRA_PROJECT_ID || "",
      doneTransitionId: process.env.JIRA_DONE_TRANSITION_ID || "41",
      doneStatusName: process.env.JIRA_DONE_STATUS_NAME || "Done",
      customFields: {
        githubRepository: process.env.JIRA_CUSTOM_GITHUB_REPOSITORY_FIELD || "",
        githubIssueNumber: process.env.JIRA_CUSTOM_GITHUB_ISSUE_NUMBER_FIELD || "",
      },
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 8000,
      nodeEnv: process.env.NODE_ENV || "development",
    },
    sync: {
      descriptions: true,
      labels: true,
      assignees: true,
      attachments: false,
      comments: true,
    },
    retry: {
      maxAttempts: 3,
      initialDelay: 1000,
    },
  };

  cachedConfig = ConfigSchema.parse(envConfig);
  return cachedConfig;
}

/**
 * Get the current configuration
 */
export function getConfig(): OctosyncConfig {
  if (!cachedConfig) {
    // Try to load from default config file path
    const defaultConfigPath = path.join(process.cwd(), "config.yaml");
    return loadConfig(defaultConfigPath);
  }
  return cachedConfig;
}

/**
 * Reset cached configuration (mainly for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}
