import { Logger } from "@nestjs/common";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
};

/**
 * Calculates an exponential backoff delay with full jitter.
 *
 * Full jitter strategy: sleep = random(0, min(cap, base * 2^attempt))
 * This prevents the "thundering herd" problem where concurrent retries
 * synchronise and re-overwhelm a recovering service.
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(maxDelayMs, exponentialDelay);
  return Math.random() * cappedDelay;
}

/**
 * Retries an async function with exponential backoff and full jitter.
 *
 * @param fn - The async function to retry.
 * @param options - Retry configuration (max retries, base delay, cap, logging callback).
 * @returns The result of the function if it succeeds within the retry limit.
 * @throws The last error encountered if all retries are exhausted.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, onRetry } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries - 1) {
        break;
      }

      const delay = calculateBackoffWithJitter(
        attempt,
        baseDelayMs,
        maxDelayMs,
      );

      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
