import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Scheduled service that prunes expired refresh tokens every night at 02:00.
 * Acts as a belt-and-suspenders fallback to the MongoDB TTL index on expiresAt —
 * the TTL index handles normal expiry; this catches any edge cases where the
 * background TTL reaper is delayed or documents slip through.
 */
@Injectable()
export class RefreshTokenCleanupService {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);

  constructor(private readonly refreshTokenService: RefreshTokenService) {}

  /** Runs at 02:00 every day. Logs how many stale records were removed. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCleanup(): Promise<void> {
    const count = await this.refreshTokenService.cleanupExpired();
    this.logger.log(
      `Refresh token cleanup complete — removed ${count} expired record(s)`,
    );
  }
}
