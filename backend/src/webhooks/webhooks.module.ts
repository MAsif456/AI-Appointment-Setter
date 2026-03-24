/**
 * NestJS feature module for the GoHighLevel webhook integration.
 *
 * Imports ClinicsModule to gain access to the exported ClinicsService,
 * which is used by WebhooksService to resolve an incoming locationId to
 * the matching clinic document. No Mongoose models are registered here
 * directly — the Clinic schema is already registered within ClinicsModule.
 *
 * Imports OrchestratorModule to delegate the AI conversation flow to
 * OrchestratorService after the clinic has been identified and validated.
 */
import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

/**
 * Registers WebhooksController and WebhooksService.
 * Depends on ClinicsModule for clinic lookup by GHL Location ID.
 * Depends on OrchestratorModule to delegate the AI conversation flow after routing.
 */
@Module({
  imports: [ClinicsModule, OrchestratorModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
