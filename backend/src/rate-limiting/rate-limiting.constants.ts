/**
 * Rate limiting constants and default tier configurations.
 * All limits are configurable via environment variables.
 */

import { RateLimitConfig } from "./rate-limiting.types";

// --- Default tier configurations ---

/** Auth tier: strict limits for authentication endpoints. */
export const DEFAULT_AUTH_TIER: RateLimitConfig = {
  tier: "auth",
  limit: 5,
  windowSeconds: 900, // 15 minutes
};

/** Read tier: standard limits for GET requests. */
export const DEFAULT_READ_TIER: RateLimitConfig = {
  tier: "read",
  limit: 100,
  windowSeconds: 60,
};

/** Write tier: tighter limits for mutating requests. */
export const DEFAULT_WRITE_TIER: RateLimitConfig = {
  tier: "write",
  limit: 30,
  windowSeconds: 60,
};

// --- Route exclusions ---

/**
 * Path prefixes excluded from the global rate limiter.
 * These routes have their own security (peer's webhook implementation).
 */
export const EXCLUDED_PATH_PREFIXES = ["/webhooks", "/ghl/webhook"];

// --- Internal service bypass ---

/** Header name for the internal service bypass key. */
export const INTERNAL_SERVICE_HEADER = "x-internal-service-key";

// --- Environment variable names ---

export const ENV_AUTH_LIMIT = "RATE_LIMIT_AUTH_LIMIT";
export const ENV_AUTH_WINDOW = "RATE_LIMIT_AUTH_WINDOW_SECONDS";
export const ENV_READ_LIMIT = "RATE_LIMIT_READ_LIMIT";
export const ENV_READ_WINDOW = "RATE_LIMIT_READ_WINDOW_SECONDS";
export const ENV_WRITE_LIMIT = "RATE_LIMIT_WRITE_LIMIT";
export const ENV_WRITE_WINDOW = "RATE_LIMIT_WRITE_WINDOW_SECONDS";
export const ENV_INTERNAL_KEY = "INTERNAL_SERVICE_KEY";

// --- Response header names ---

export const HEADER_RATE_LIMIT = "X-RateLimit-Limit";
export const HEADER_RATE_REMAINING = "X-RateLimit-Remaining";
export const HEADER_RATE_RESET = "X-RateLimit-Reset";
export const HEADER_RETRY_AFTER = "Retry-After";

// --- Counter TTL ---

/** Maximum TTL for counters (matches the longest window: 15 min). */
export const COUNTER_TTL_SECONDS = 900;
