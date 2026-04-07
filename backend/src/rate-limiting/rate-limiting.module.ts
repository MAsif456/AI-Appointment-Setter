import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { RateLimitingService } from "./rate-limiting.service";
import { RateLimitingGuard } from "./rate-limiting.guard";
import {
  RateLimitCounter,
  RateLimitCounterSchema,
} from "./schemas/rate-limit-counter.schema";
import { AnalyticsModule } from "../analytics/analytics.module";

/**
 * Global rate limiting module.
 * Registers the RateLimitingGuard as APP_GUARD so all current and
 * future routes are automatically protected without per-route config.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RateLimitCounter.name, schema: RateLimitCounterSchema },
    ]),
    ConfigModule,
    AnalyticsModule,
  ],
  providers: [
    RateLimitingService,
    { provide: APP_GUARD, useClass: RateLimitingGuard },
  ],
  exports: [RateLimitingService],
})
export class RateLimitingModule {}
