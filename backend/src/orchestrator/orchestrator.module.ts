/**
 * NestJS feature module for the conversation orchestrator.
 *
 * Imports AiModule for GreetingService and GroqService (Ibby's US-09).
 * Imports GhlModule for ConversationsService, MessagesService, and GhlApiService (Suli's US-08).
 * Exports OrchestratorService so WebhooksModule can call it after routing.
 */
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { GhlModule } from '../ghl/ghl.module';
import { CancellationModule } from '../cancellation/cancellation.module';
import { OrchestratorService } from './orchestrator.service';
import { PostcodeValidationService } from './postcode-validation.service';

@Module({
  imports: [AiModule, GhlModule, CancellationModule],
  providers: [OrchestratorService, PostcodeValidationService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
