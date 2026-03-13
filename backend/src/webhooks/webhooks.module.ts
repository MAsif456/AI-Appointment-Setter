/**
 * NestJS feature module for the GoHighLevel webhook integration.
 *
 * Imports ClinicsModule to gain access to the exported ClinicsService,
 * which is used by WebhooksService to resolve an incoming locationId to
 * the matching clinic document. No Mongoose models are registered here
 * directly — the Clinic schema is already registered within ClinicsModule.
 */
import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

/**
 * Registers WebhooksController and WebhooksService.
 * Depends on ClinicsModule for clinic lookup by GHL Location ID.
 */
@Module({
  imports: [ClinicsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
