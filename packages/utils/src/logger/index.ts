import winston from "winston";
import { getConfig } from "../config";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
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
        filename: "logs/error.log",
        level: "error",
        format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
      }),
      // File transport for all logs
      new winston.transports.File({
        filename: "logs/combined.log",
        format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
      }),
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: "logs/exceptions.log" }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: "logs/rejections.log" }),
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
