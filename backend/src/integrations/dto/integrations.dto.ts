import { IsString, IsUrl, IsOptional, MinLength } from 'class-validator';

/**
 * Response returned to the frontend for all integration settings reads.
 * The API key is always masked — the plaintext key is never returned.
 */
export interface IntegrationSettingsResponse {
  /** Masked key, e.g. "••••••••••••abc123". Empty string if no key is stored. */
  ghlApiKey: string;
  /** Current webhook delivery URL. */
  webhookUrl: string;
  /** Whether the stored key has been verified against the GHL API. */
  ghlConnectionStatus: 'connected' | 'disconnected';
}

/**
 * Payload for PUT /api/integrations.
 * Both fields are optional so callers can update only what changed.
 */
export class UpdateIntegrationsDto {
  /**
   * New GHL Private Integration Token.
   * If provided, must be ≥10 characters and will be validated against GHL
   * before being encrypted and stored.
   */
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'API key must be at least 10 characters' })
  ghlApiKey?: string;

  /**
   * New webhook URL. Must be a valid HTTPS URL.
   */
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Webhook URL must be a valid HTTPS URL' },
  )
  webhookUrl?: string;
}
