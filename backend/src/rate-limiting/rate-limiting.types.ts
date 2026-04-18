/**
 * Rate limiting type definitions.
 * Shared interfaces used across the rate limiting module.
 */

/** Available rate limit tiers mapped to endpoint groups. */
export type RateLimitTier = "auth" | "read" | "write" | "csp-report";

/** Configuration for a single rate limit tier. */
export interface RateLimitConfig {
  /** Tier identifier. */
  tier: RateLimitTier;
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

/** Result returned after checking and incrementing a rate limit counter. */
export interface CounterResult {
  /** Whether the request is allowed through. */
  allowed: boolean;
  /** Maximum requests allowed in the current window. */
  limit: number;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Date when the current window resets. */
  resetAt: Date;
}
