export enum LogLevel {
  INFO = "INFO",
  SUCCESS = "SUCCESS",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogOptions {
  context?: string;
  data?: any;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(
  level: LogLevel,
  message: string,
  options?: LogOptions
): string {
  const timestamp = formatTimestamp();
  const contextStr = options?.context ? ` [${options.context}]` : "";
  const baseMessage = `[${timestamp}] [${level}]${contextStr} ${message}`;

  if (options?.data) {
    return `${baseMessage}\n${JSON.stringify(options.data, null, 2)}`;
  }

  return baseMessage;
}

export const logger = {
  info(message: string, options?: LogOptions) {
    console.log(formatMessage(LogLevel.INFO, message, options));
  },

  success(message: string, options?: LogOptions) {
    console.log(formatMessage(LogLevel.SUCCESS, message, options));
  },

  warn(message: string, options?: LogOptions) {
    console.warn(formatMessage(LogLevel.WARN, message, options));
  },

  error(message: string, options?: LogOptions) {
    console.error(formatMessage(LogLevel.ERROR, message, options));
  },
};
