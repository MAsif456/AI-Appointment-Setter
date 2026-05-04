import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntegrationSettingsDocument = IntegrationSettings & Document;

/**
 * Stores the GoHighLevel integration credentials and webhook configuration.
 * A single global document is maintained (upserted via findOneAndUpdate).
 * The API key is stored encrypted — never as plaintext.
 */
@Schema({ timestamps: true, collection: 'integrationsettings' })
export class IntegrationSettings {
  /**
   * AES-256-GCM encrypted GHL Private Integration Token.
   * Format on disk: "iv:authTag:ciphertext" (all hex-encoded).
   */
  @Prop({ default: '' })
  ghlApiKey: string;

  /**
   * Last 6 characters of the original plaintext API key.
   * Stored to allow masked display (e.g. "••••••••••••abc123")
   * without ever returning the full key.
   */
  @Prop({ default: '' })
  ghlApiKeyPreview: string;

  /**
   * Publicly accessible HTTPS URL where GHL delivers
   * ContactCreate and InboundMessage webhook events.
   */
  @Prop({ default: '' })
  webhookUrl: string;

  /**
   * Whether the stored API key has been verified against the GHL API.
   * Updated automatically on save and on explicit test-connection calls.
   */
  @Prop({ type: String, enum: ['connected', 'disconnected'], default: 'disconnected' })
  ghlConnectionStatus: 'connected' | 'disconnected';
}

export const IntegrationSettingsSchema = SchemaFactory.createForClass(IntegrationSettings);
