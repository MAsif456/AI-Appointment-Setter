import { IsString, IsUrl, IsOptional, MinLength } from 'class-validator';

/**
 * Payload for PUT /clinics/:id/integrations.
 * Validates and updates the per-clinic GHL API key and optional webhook URL.
 */
export class UpdateIntegrationDto {
  /**
   * Plaintext GHL private integration token for this clinic.
   * Validated against the GHL API before being encrypted and stored.
   */
  @IsString()
  @MinLength(10, { message: 'API key must be at least 10 characters' })
  ghlApiKey: string;

  /**
   * Webhook delivery URL for inbound GHL events.
   * Must be a valid HTTPS URL if provided.
   */
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Webhook URL must be a valid HTTPS URL' },
  )
  webhookUrl?: string;
}
