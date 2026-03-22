import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GroqService } from './groq.service';
import { GreetingService } from './greeting.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { SlotProvider } from './slot-provider';
import { AppointmentsModule } from '../appointments/appointments.module';

/**
 * AI module that registers all AI-related services and controllers.
 * Imports ConfigModule for env vars and AppointmentsModule for GHL slot fetching.
 * Exports GreetingService, ChatService, and SlotProvider for use by other modules.
 */
@Module({
  imports: [ConfigModule, AppointmentsModule],
  controllers: [ChatController],
  providers: [GroqService, GreetingService, ChatService, SlotProvider],
  exports: [GreetingService, ChatService, SlotProvider],
})
export class AiModule {}
