/**
 * NestJS module for analytics operations.
 *
 * Combines the dashboard analytics services (overview + per-clinic) with
 * the security-event logging service into a single module so the dashboard
 * and staff security feed share one controller surface.
 */
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Conversation,
  ConversationSchema,
} from "../database/schemas/conversation.schema";
import { Lead, LeadSchema } from "../database/schemas/lead.schema";
import { Clinic, ClinicSchema } from "../database/schemas/clinic.schema";
import {
  SecurityEvent,
  SecurityEventSchema,
} from "./schemas/security-event.schema";
import { AnalyticsController } from "./analytics.controller";
import { OverviewAnalyticsService } from "./overview-analytics.service";
import { ClinicAnalyticsService } from "./clinic-analytics.service";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Clinic.name, schema: ClinicSchema },
      { name: SecurityEvent.name, schema: SecurityEventSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [OverviewAnalyticsService, ClinicAnalyticsService, AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
