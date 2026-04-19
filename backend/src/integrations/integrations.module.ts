import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import {
  IntegrationSettings,
  IntegrationSettingsSchema,
} from '../database/schemas/integration-settings.schema';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

/**
 * Provides the integrations settings feature:
 * storing, encrypting and validating GoHighLevel credentials.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationSettings.name, schema: IntegrationSettingsSchema },
    ]),
    HttpModule.register({ timeout: 8000 }),
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
