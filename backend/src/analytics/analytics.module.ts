import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import {
  SecurityEvent,
  SecurityEventSchema,
} from "./schemas/security-event.schema";

/**
 * Analytics module.
 * Provides security event logging and a query endpoint for the
 * Lunax staff dashboard to monitor rate limit breaches and auth threats.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SecurityEvent.name, schema: SecurityEventSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
