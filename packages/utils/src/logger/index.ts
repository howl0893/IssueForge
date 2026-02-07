import winston from "winston";
import { getConfig } from "../config";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Sanitize user input for safe logging (prevent log injection)
function sanitizeForLog(value: any): string {
  if (typeof value !== "string") {
    return String(value);
  }
  // Remove newlines and control characters that could be used for log injection
  return value.replace(/[\r\n\t\x00-\x1f\x7f-\x9f]/g, "");
}

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Add metadata if present (sanitize values)
  if (Object.keys(metadata).length > 0) {
    const sanitizedMeta: any = {};
    for (const [key, value] of Object.entries(metadata)) {
      sanitizedMeta[key] = typeof value === "string" ? sanitizeForLog(value) : value;
    }
    msg += ` ${JSON.stringify(sanitizedMeta)}`;
  }
  
  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

// Create logger instance
let logger: winston.Logger | null = null;

export function createLogger(): winston.Logger {
  if (logger) {
    return logger;
  }

  const config = getConfig();
  const isDevelopment = config.server?.nodeEnv === "development";
  const logDirectory = config.logging?.directory || "logs";

  // Ensure log directory exists
  const fs = require("fs");
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  logger = winston.createLogger({
    level: isDevelopment ? "debug" : "info",
    format: combine(
      errors({ stack: true }),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      logFormat
    ),
    transports: [
      // Console transport
      new winston.transports.Console({
        format: isDevelopment
          ? combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat)
          : combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
      }),
      // File transport for errors
      new winston.transports.File({
        filename: `${logDirectory}/error.log`,
        level: "error",
        format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
      }),
      // File transport for all logs
      new winston.transports.File({
        filename: `${logDirectory}/combined.log`,
        format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
      }),
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: `${logDirectory}/exceptions.log` }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: `${logDirectory}/rejections.log` }),
    ],
  });

  return logger;
}

export function getLogger(): winston.Logger {
  if (!logger) {
    return createLogger();
  }
  return logger;
}
