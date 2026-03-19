import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GroqService } from './groq.service';
import { GreetingService } from './greeting.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { SlotProvider } from './slot-provider';

/**
 * AI module that registers all AI-related services and controllers.
 * Imports ConfigModule to access environment variables (GROQ_API_KEY).
 * Exports GreetingService, ChatService, and SlotProvider for use by other modules.
 */
@Module({
  imports: [ConfigModule],
  controllers: [ChatController],
  providers: [GroqService, GreetingService, ChatService, SlotProvider],
  exports: [GreetingService, ChatService, SlotProvider],
})
export class AiModule {}
