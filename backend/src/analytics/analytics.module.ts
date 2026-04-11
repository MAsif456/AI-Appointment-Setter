/**
 * NestJS module for analytics operations.
 * Registers all required Mongoose models, the controller, and both analytics services.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from '../database/schemas/conversation.schema';
import { Lead, LeadSchema } from '../database/schemas/lead.schema';
import { Message, MessageSchema } from '../database/schemas/message.schema';
import { Clinic, ClinicSchema } from '../database/schemas/clinic.schema';
import { AnalyticsController } from './analytics.controller';
import { OverviewAnalyticsService } from './overview-analytics.service';
import { ClinicAnalyticsService } from './clinic-analytics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Clinic.name, schema: ClinicSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [OverviewAnalyticsService, ClinicAnalyticsService],
})
export class AnalyticsModule {}
