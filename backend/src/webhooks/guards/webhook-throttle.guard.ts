import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { Request } from "express";
import {
  WEBHOOK_RATE_LIMIT,
  WEBHOOK_RATE_WINDOW_SECONDS,
  RATE_LIMIT_CLEANUP_INTERVAL_MS,
} from "../constants/webhook.constants";

interface RateBucket {
  prevCount: number;
  currCount: number;
  currWindowStart: number;
}

@Injectable()
export class WebhookThrottleGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(WebhookThrottleGuard.name);
  private readonly buckets = new Map<string, RateBucket>();
  private readonly limit = WEBHOOK_RATE_LIMIT;
  private readonly windowMs = WEBHOOK_RATE_WINDOW_SECONDS * 1000;
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  /**
   * Constructs a new WebhookThrottleGuard instance.
   *
   * Initializes a recurring timer to purge stale rate limit keys
   * after a fixed interval (RATE_LIMIT_CLEANUP_INTERVAL_MS).
   */
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.purgeStaleKeys();
    }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
  }

  /**
   * Cleans up the interval used to periodically purge stale rate limit keys.
   */
  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Checks if the incoming request is rate limited based on IP address.
   * If the request is rate limited, throws an HttpException with a status code of 429.
   * @param context The ExecutionContext object containing the request.
   * @returns A boolean indicating whether the request is rate limited or not.
   */
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const body = req.body as Record<string, unknown> | undefined;
    const locationId = (body?.location as Record<string, unknown>)?.id as
      | string
      | undefined;

    if (this.isRateLimited(`ip:${ip}`)) {
      this.logger.warn(`Rate limit exceeded for IP: ${ip}`);
      throw new HttpException(
        "Too Many Requests",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (locationId && this.isRateLimited(`loc:${locationId}`)) {
      this.logger.warn(`Rate limit exceeded for locationId: ${locationId}`);
      throw new HttpException(
        "Too Many Requests",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  
  /**
   * Checks if the given rate limit key has exceeded the rate limit.
   * Calculates the effective count of requests in the current window by
   * linearly interpolating between the previous and current counts.
   * If the effective count exceeds the rate limit, returns true.
   * Otherwise, increments the current count and returns false.
   *
   * @param key The rate limit key to check.
   * @returns A boolean indicating whether the rate limit has been exceeded.
   * 
   * Ref: https://arpitbhayani.me/blogs/sliding-window-ratelimiter/
   */
  private isRateLimited(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { prevCount: 0, currCount: 0, currWindowStart: now };
      this.buckets.set(key, bucket);
    }

    const elapsed = now - bucket.currWindowStart;
    if (elapsed >= this.windowMs) {
      if (elapsed >= this.windowMs * 2) {
        bucket.prevCount = 0;
      } else {
        bucket.prevCount = bucket.currCount;
      }
      bucket.currCount = 0;
      bucket.currWindowStart = now - (elapsed % this.windowMs);
    }

    const elapsedInWindow = now - bucket.currWindowStart;
    const overlapWeight = 1 - elapsedInWindow / this.windowMs;
    const effectiveCount =
      Math.floor(bucket.prevCount * overlapWeight) + bucket.currCount;

    if (effectiveCount >= this.limit) {
      return true;
    }

    bucket.currCount++;
    return false;
  }

  /**
   * Periodically cleans up stale keys from the rate limiter.
   *
   * This method is called automatically by the rate limiter when a new key is added.
   * It checks each key in the rate limiter and removes those that are older than 2 times the window size.
   * This is done to prevent the rate limiter from growing indefinitely and using up too much memory.
   */
  private purgeStaleKeys(): void {
    const now = Date.now();
    const expiryThreshold = this.windowMs * 2;

    for (const [key, bucket] of this.buckets) {
      if (now - bucket.currWindowStart > expiryThreshold) {
        this.buckets.delete(key);
      }
    }
  }
}
