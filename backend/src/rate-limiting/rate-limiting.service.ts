import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import {
  RateLimitCounter,
  RateLimitCounterDocument,
} from "./schemas/rate-limit-counter.schema";
import { RateLimitConfig, CounterResult } from "./rate-limiting.types";
import {
  DEFAULT_AUTH_TIER,
  DEFAULT_READ_TIER,
  DEFAULT_WRITE_TIER,
  DEFAULT_CSP_REPORT_TIER,
  ENV_AUTH_LIMIT,
  ENV_AUTH_WINDOW,
  ENV_READ_LIMIT,
  ENV_READ_WINDOW,
  ENV_WRITE_LIMIT,
  ENV_WRITE_WINDOW,
  ENV_CSP_REPORT_LIMIT,
  ENV_CSP_REPORT_WINDOW,
} from "./rate-limiting.constants";

@Injectable()
export class RateLimitingService {
  private readonly logger = new Logger(RateLimitingService.name);
  private readonly authTier: RateLimitConfig;
  private readonly readTier: RateLimitConfig;
  private readonly writeTier: RateLimitConfig;
  private readonly cspReportTier: RateLimitConfig;

  constructor(
    @InjectModel(RateLimitCounter.name)
    private readonly counterModel: Model<RateLimitCounterDocument>,
    private readonly config: ConfigService,
  ) {
    // Load tier configs from env vars, falling back to defaults
    this.authTier = {
      tier: "auth",
      limit: this.readNumericEnv(ENV_AUTH_LIMIT, DEFAULT_AUTH_TIER.limit),
      windowSeconds: this.readNumericEnv(
        ENV_AUTH_WINDOW,
        DEFAULT_AUTH_TIER.windowSeconds,
      ),
    };
    this.readTier = {
      tier: "read",
      limit: this.readNumericEnv(ENV_READ_LIMIT, DEFAULT_READ_TIER.limit),
      windowSeconds: this.readNumericEnv(
        ENV_READ_WINDOW,
        DEFAULT_READ_TIER.windowSeconds,
      ),
    };
    this.writeTier = {
      tier: "write",
      limit: this.readNumericEnv(ENV_WRITE_LIMIT, DEFAULT_WRITE_TIER.limit),
      windowSeconds: this.readNumericEnv(
        ENV_WRITE_WINDOW,
        DEFAULT_WRITE_TIER.windowSeconds,
      ),
    };
    this.cspReportTier = {
      tier: "csp-report",
      limit: this.readNumericEnv(
        ENV_CSP_REPORT_LIMIT,
        DEFAULT_CSP_REPORT_TIER.limit,
      ),
      windowSeconds: this.readNumericEnv(
        ENV_CSP_REPORT_WINDOW,
        DEFAULT_CSP_REPORT_TIER.windowSeconds,
      ),
    };
  }

  /**
   * Reads a numeric environment variable, coercing strings to numbers.
   * Falls back to the provided default if the value is missing or NaN.
   */
  private readNumericEnv(envKey: string, defaultValue: number): number {
    const raw = this.config.get<string | number>(envKey);
    if (raw === undefined || raw === null || raw === "") {
      return defaultValue;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      this.logger.warn(
        `Invalid numeric value for ${envKey}: "${raw}", using default ${defaultValue}`,
      );
      return defaultValue;
    }
    return parsed;
  }

  /**
   * Determines the rate limit tier for a request based on path and HTTP method.
   * @param path - The request URL path (e.g. "/auth/login").
   * @param method - The HTTP method (e.g. "GET", "POST").
   * @returns The matching RateLimitConfig for the request.
   */
  determineTier(path: string, method: string): RateLimitConfig {
    if (path.startsWith("/auth")) {
      return this.authTier;
    }

    if (path.startsWith("/security/csp-report")) {
      return this.cspReportTier;
    }

    const upper = method.toUpperCase();
    if (upper === "GET" || upper === "HEAD" || upper === "OPTIONS") {
      return this.readTier;
    }

    return this.writeTier;
  }

  /**
   * Builds a composite rate limit key from tier, method, and identifier.
   * @param tier - The tier name (e.g. "read").
   * @param method - The HTTP method (e.g. "GET").
   * @param identifier - The user or IP identifier (e.g. "ip_192.168.1.1").
   * @returns A string key used to track the counter in MongoDB.
   */
  buildKey(tier: string, method: string, identifier: string): string {
    return `${tier}:${method.toUpperCase()}:${identifier}`;
  }

  /**
   * Atomically increments a rate limit counter and checks whether the
   * request is within the allowed limit. Uses MongoDB findOneAndUpdate
   * with upsert for atomic, multi-instance-safe counter management.
   *
   * Implements fail-open: if the database is unavailable, the request
   * is allowed through and a warning is logged.
   *
   * @param key - The composite rate limit key.
   * @param tierConfig - The tier configuration with limit and window.
   * @returns A CounterResult indicating whether the request is allowed.
   */
  async checkAndIncrement(
    key: string,
    tierConfig: RateLimitConfig,
  ): Promise<CounterResult> {
    const { limit, windowSeconds } = tierConfig;

    try {
      const now = new Date();
      const windowMs = windowSeconds * 1000;
      // Floor current time to the window boundary
      const windowStart = new Date(
        Math.floor(now.getTime() / windowMs) * windowMs,
      );
      const expiresAt = new Date(windowStart.getTime() + windowMs);

      // First, try to increment an existing counter in the current window
      let counter = await this.counterModel.findOneAndUpdate(
        { key, windowStart: { $gte: windowStart } },
        { $inc: { count: 1 } },
        { returnDocument: 'after' },
      );

      // If no current-window counter exists, reset the key for the new window
      if (!counter) {
        counter = await this.counterModel.findOneAndUpdate(
          { key },
          { $set: { count: 1, windowStart, expiresAt } },
          { upsert: true, returnDocument: 'after' },
        );
      }

      const count = counter?.count ?? 1;
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      return { allowed, limit, remaining, resetAt: expiresAt };
    } catch (error) {
      // Fail-open: allow the request and log a warning
      this.logger.warn(
        `Rate limit check failed for key "${key}", allowing request: ${(error as Error).message}`,
      );
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetAt: new Date(),
      };
    }
  }
}
