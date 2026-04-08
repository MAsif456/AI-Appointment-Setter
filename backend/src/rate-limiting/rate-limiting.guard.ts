import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import * as crypto from "crypto";
import { RateLimitingService } from "./rate-limiting.service";
import { AnalyticsService } from "../analytics/analytics.service";
import {
  EXCLUDED_PATH_PREFIXES,
  INTERNAL_SERVICE_HEADER,
  ENV_INTERNAL_KEY,
  HEADER_RATE_LIMIT,
  HEADER_RATE_REMAINING,
  HEADER_RATE_RESET,
  HEADER_RETRY_AFTER,
} from "./rate-limiting.constants";

/**
 * Global rate limiting guard registered via APP_GUARD.
 * Automatically applies to all routes; webhook paths are excluded.
 * Implements fail-open: if the counter store is unavailable, requests pass through.
 */
@Injectable()
export class RateLimitingGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitingGuard.name);
  private readonly internalKey: string | undefined;

  constructor(
    private readonly rateLimitingService: RateLimitingService,
    private readonly config: ConfigService,
    private readonly analyticsService: AnalyticsService,
  ) {
    this.internalKey = this.config.get<string>(ENV_INTERNAL_KEY);
  }

  /**
   * Evaluates whether the incoming request is allowed through the rate limiter.
   * @param context - The NestJS execution context for the current request.
   * @returns True if allowed, throws HttpException(429) if rate limited.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const path = req.path ?? req.url;
    const method = req.method;

    // Skip webhook routes (peer's security handles these)
    if (this.isExcludedPath(path)) {
      return true;
    }

    // Internal service bypass via constant-time key comparison
    const providedKey = req.headers[INTERNAL_SERVICE_HEADER] as
      | string
      | undefined;
    if (providedKey && this.internalKey) {
      if (this.isValidInternalKey(providedKey, this.internalKey)) {
        return true;
      }
      this.logger.warn(
        `Invalid internal service key from IP: ${this.extractIp(req)}`,
      );
    }

    // Determine tier and build the counter key
    const tierConfig = this.rateLimitingService.determineTier(path, method);
    const identifier = this.extractIdentifier(req);
    const key = this.rateLimitingService.buildKey(
      tierConfig.tier,
      method,
      identifier,
    );

    // Check the counter store
    const result = await this.rateLimitingService.checkAndIncrement(
      key,
      tierConfig,
    );

    // Set rate limit response headers on every response
    const resetEpoch = Math.ceil(result.resetAt.getTime() / 1000);
    res.setHeader(HEADER_RATE_LIMIT, result.limit);
    res.setHeader(HEADER_RATE_REMAINING, result.remaining);
    res.setHeader(HEADER_RATE_RESET, resetEpoch);

    if (!result.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
      );
      res.setHeader(HEADER_RETRY_AFTER, retryAfter);

      this.logger.warn(
        `Rate limit exceeded: tier=${tierConfig.tier} key=${key} ip=${this.extractIp(req)}`,
      );

      // Fire-and-forget security event logging
      this.analyticsService.logSecurityEvent({
        eventType: "rate_limit_exceeded",
        ip: this.extractIp(req),
        endpoint: path,
        tier: tierConfig.tier,
        windowRemaining: result.remaining,
      });

      throw new HttpException(
        "Too Many Requests",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /** Checks if the request path matches an excluded prefix. */
  private isExcludedPath(path: string): boolean {
    return EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  /** Extracts a user ID or IP address as the rate limit identifier. */
  private extractIdentifier(req: Request): string {
    const user = (req as any).user;
    if (user?.id) {
      return `user_${user.id}`;
    }
    return `ip_${this.extractIp(req)}`;
  }

  /** Extracts the client IP address from the request. */
  private extractIp(req: Request): string {
    return req.ip ?? req.socket?.remoteAddress ?? "unknown";
  }

  /**
   * Compares two strings in constant time to prevent timing attacks.
   * Returns false if the lengths differ (unavoidable length leak).
   */
  private isValidInternalKey(provided: string, expected: string): boolean {
    if (provided.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(provided, "utf-8"),
      Buffer.from(expected, "utf-8"),
    );
  }
}
