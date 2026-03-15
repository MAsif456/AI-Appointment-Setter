/**
 * NestJS feature module for the conversation orchestrator.
 *
 * Imports AiModule to access GreetingService (for new lead greetings) and
 * GroqService (for intent-specific and multi-turn AI responses).
 * Exports OrchestratorService so WebhooksModule can call it after routing.
 */
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [AiModule],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
