import pRetry, { AbortError } from "p-retry";
import { getConfig } from "../config";
import { getLogger } from "../logger";

const logger = getLogger();

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const config = getConfig();
  const maxAttempts = options?.maxAttempts ?? config.retry?.maxAttempts ?? 3;
  const minTimeout = options?.initialDelay ?? config.retry?.initialDelay ?? 1000;

  return pRetry(
    async () => {
      try {
        return await fn();
      } catch (error: any) {
        // Don't retry on specific errors
        if (isNonRetryableError(error)) {
          logger.error("Non-retryable error encountered", { error: error.message });
          throw new AbortError(error);
        }
        throw error;
      }
    },
    {
      retries: maxAttempts - 1,
      minTimeout,
      factor: 2, // Exponential backoff
      onFailedAttempt: (error) => {
        logger.warn(
          `Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
        );
        
        if (options?.onRetry) {
          const err = new Error(String(error));
          options.onRetry(err, error.attemptNumber);
        }
      },
    }
  );
}

/**
 * Determine if an error should not be retried
 */
function isNonRetryableError(error: any): boolean {
  // Don't retry on authentication errors
  if (error.status === 401 || error.status === 403) {
    return true;
  }

  // Don't retry on client errors (except rate limits and timeouts)
  if (error.status >= 400 && error.status < 500) {
    // Retry on rate limits
    if (error.status === 429) {
      return false;
    }
    // Retry on timeouts
    if (error.status === 408) {
      return false;
    }
    return true;
  }

  return false;
}
