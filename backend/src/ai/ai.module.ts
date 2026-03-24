import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GroqService } from './groq.service';
import { GreetingService } from './greeting.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { SlotProvider } from './slot-provider';
import { UrgencyLlmClassifier } from './urgency-llm-classifier';
import { UrgencyPipeline } from './urgency-pipeline';
import { AppointmentsModule } from '../appointments/appointments.module';

/**
 * AI module that registers all AI-related services and controllers.
 * Imports ConfigModule for env vars and AppointmentsModule for GHL slot fetching.
 * Exports GreetingService, ChatService, SlotProvider, and UrgencyPipeline for use by other modules.
 */
@Module({
  imports: [ConfigModule, AppointmentsModule],
  controllers: [ChatController],
  providers: [GroqService, GreetingService, ChatService, SlotProvider, UrgencyLlmClassifier, UrgencyPipeline],
  exports: [GreetingService, ChatService, SlotProvider, UrgencyPipeline],
})
export class AiModule {}
