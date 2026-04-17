import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  LoginAttempt,
  LoginAttemptDocument,
} from "./schemas/login-attempt.schema";
import { AnalyticsService } from "../analytics/analytics.service";

/** Window duration for login attempt tracking (15 minutes). */
const WINDOW_SECONDS = 900;

/** IP-based lockout threshold (full lockout after 11+ failures). */
const IP_LOCKOUT_THRESHOLD = 11;

/** Progressive delay threshold (2s delay for failures 6-10). */
const IP_DELAY_THRESHOLD = 6;

/** Account-level lockout threshold (cross-IP, 10 failures). */
const ACCOUNT_LOCKOUT_THRESHOLD = 10;

/** Artificial delay in milliseconds applied during progressive penalty. */
const PROGRESSIVE_DELAY_MS = 2000;

@Injectable()
export class AuthThrottleService {
  private readonly logger = new Logger(AuthThrottleService.name);

  constructor(
    @InjectModel(LoginAttempt.name)
    private readonly loginAttemptModel: Model<LoginAttemptDocument>,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Checks whether the given IP or account is throttled.
   * Progressive penalties: 1-5 normal, 6-10 add 2s delay, 11+ full lockout.
   * Account-level: 10+ cross-IP failures return a generic error.
   * Fails open if the database is unavailable.
   * @param ip - The client IP address.
   * @param email - The email address being targeted.
   */
  async checkThrottle(ip: string, email: string): Promise<void> {
    try {
      const [ipRecord, accountRecord] = await Promise.all([
        this.loginAttemptModel.findOne({ key: `ip:${ip}` }),
        this.loginAttemptModel.findOne({ key: `account:${email}` }),
      ]);

      // Account-level lockout (cross-IP) — generic error to prevent enumeration
      if (
        accountRecord &&
        accountRecord.failureCount >= ACCOUNT_LOCKOUT_THRESHOLD
      ) {
        this.logger.warn(
          `Account lockout triggered for email: ${email} (${accountRecord.failureCount} failures)`,
        );
        this.analyticsService.logSecurityEvent({
          eventType: "account_locked",
          ip,
          email,
          endpoint: "/auth/login",
          tier: "auth",
        });
        throw new HttpException(
          "Invalid credentials",
          HttpStatus.UNAUTHORIZED,
        );
      }

      // IP-based full lockout (11+ failures)
      if (ipRecord && ipRecord.failureCount >= IP_LOCKOUT_THRESHOLD) {
        this.logger.warn(
          `IP lockout triggered for ${ip} (${ipRecord.failureCount} failures)`,
        );
        this.analyticsService.logSecurityEvent({
          eventType: "ip_locked",
          ip,
          email,
          endpoint: "/auth/login",
          tier: "auth",
        });
        throw new HttpException(
          "Too many login attempts. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Progressive delay (6-10 failures) — slow down automated attacks
      if (ipRecord && ipRecord.failureCount >= IP_DELAY_THRESHOLD) {
        this.logger.log(
          `Progressive delay applied for IP ${ip} (${ipRecord.failureCount} failures)`,
        );
        await this.delay(PROGRESSIVE_DELAY_MS);
      }
    } catch (error) {
      // Re-throw HttpExceptions (our own throttle responses)
      if (error instanceof HttpException) {
        throw error;
      }
      // Fail-open for database errors
      this.logger.warn(
        `Auth throttle check failed, allowing request: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Records a failed login attempt for both IP and account keys.
   * Uses atomic findOneAndUpdate with upsert for multi-instance safety.
   * @param ip - The client IP address.
   * @param email - The targeted email address.
   */
  async recordFailure(ip: string, email: string): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + WINDOW_SECONDS * 1000);

      await Promise.all([
        this.upsertAttempt(`ip:${ip}`, now, expiresAt),
        this.upsertAttempt(`account:${email}`, now, expiresAt),
      ]);

      this.analyticsService.logSecurityEvent({
        eventType: "login_failed",
        ip,
        email,
        endpoint: "/auth/login",
        tier: "auth",
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record login failure: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Clears failure counters on successful login for both IP and account.
   * @param ip - The client IP address.
   * @param email - The email that logged in successfully.
   */
  async recordSuccess(ip: string, email: string): Promise<void> {
    try {
      await Promise.all([
        this.loginAttemptModel.deleteOne({ key: `ip:${ip}` }),
        this.loginAttemptModel.deleteOne({ key: `account:${email}` }),
      ]);
    } catch (error) {
      this.logger.warn(
        `Failed to clear login attempts: ${(error as Error).message}`,
      );
    }
  }

  /** Atomically increments the failure counter for a given key. */
  private async upsertAttempt(
    key: string,
    now: Date,
    expiresAt: Date,
  ): Promise<void> {
    await this.loginAttemptModel.findOneAndUpdate(
      { key },
      {
        $inc: { failureCount: 1 },
        $setOnInsert: { key, windowStart: now, expiresAt },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }

  /** Returns a promise that resolves after the specified delay. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
