import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { lastValueFrom } from 'rxjs';
import {
  IntegrationSettings,
  IntegrationSettingsDocument,
} from '../database/schemas/integration-settings.schema';
import {
  UpdateIntegrationsDto,
  IntegrationSettingsResponse,
} from './dto/integrations.dto';

/** GHL REST API base URL used for credential validation. */
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

/** GHL API version header required for all requests. */
const GHL_API_VERSION = '2021-07-28';

/**
 * Manages GoHighLevel integration settings.
 * Handles encrypted storage of the API key, masked retrieval,
 * and live credential validation against the GHL API.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectModel(IntegrationSettings.name)
    private readonly model: Model<IntegrationSettingsDocument>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /** Returns current settings with the API key masked for safe display. */
  async getSettings(): Promise<IntegrationSettingsResponse> {
    const doc = await this.model.findOne().lean().exec();
    return this.toResponse(doc);
  }

  /**
   * Updates integration settings.
   * When a new API key is provided it is validated against GHL before storing.
   * The key is encrypted with AES-256-GCM before persisting to MongoDB.
   */
  async updateSettings(dto: UpdateIntegrationsDto): Promise<IntegrationSettingsResponse> {
    const update: Partial<IntegrationSettings> = {};

    if (dto.ghlApiKey !== undefined) {
      const connected = await this.testApiKey(dto.ghlApiKey);
      if (!connected) {
        throw new BadRequestException(
          'Could not connect to GoHighLevel. Please check your API key.',
        );
      }
      update.ghlApiKey = this.encryptKey(dto.ghlApiKey);
      update.ghlApiKeyPreview = dto.ghlApiKey.slice(-6);
      update.ghlConnectionStatus = 'connected';
    }

    if (dto.webhookUrl !== undefined) {
      update.webhookUrl = dto.webhookUrl;
    }

    const updated = await this.model
      .findOneAndUpdate({}, { $set: update }, { upsert: true, new: true })
      .lean()
      .exec();

    return this.toResponse(updated);
  }

  /**
   * Tests the stored API key against the GHL API and persists the result.
   * Returns the current connection status.
   */
  async testConnection(): Promise<{ status: 'connected' | 'disconnected' }> {
    const doc = await this.model.findOne().lean().exec();
    if (!doc?.ghlApiKey) {
      return { status: 'disconnected' };
    }

    let plainKey: string;
    try {
      plainKey = this.decryptKey(doc.ghlApiKey);
    } catch {
      return { status: 'disconnected' };
    }

    const connected = await this.testApiKey(plainKey);
    const status: 'connected' | 'disconnected' = connected ? 'connected' : 'disconnected';

    await this.model
      .findOneAndUpdate({}, { $set: { ghlConnectionStatus: status } }, { upsert: true })
      .exec();

    return { status };
  }

  /** Clears the stored API key and marks the integration as disconnected. */
  async disconnect(): Promise<void> {
    await this.model
      .findOneAndUpdate(
        {},
        { $set: { ghlApiKey: '', ghlApiKeyPreview: '', ghlConnectionStatus: 'disconnected' } },
        { upsert: true },
      )
      .exec();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Maps a raw document (or null) to the safe response shape. */
  private toResponse(doc: IntegrationSettings | null): IntegrationSettingsResponse {
    const hasKey = !!doc?.ghlApiKey;
    return {
      ghlApiKey: hasKey ? `••••••••••••${doc.ghlApiKeyPreview}` : '',
      webhookUrl: doc?.webhookUrl ?? '',
      ghlConnectionStatus: doc?.ghlConnectionStatus ?? 'disconnected',
    };
  }

  /**
   * Makes a lightweight GHL API request to verify the key is accepted.
   * Any non-401/403 response (including 404) indicates the credentials are valid.
   */
  async testApiKey(plainKey: string): Promise<boolean> {
    try {
      const response = await lastValueFrom(
        this.httpService.get('/locations/search?limit=1', {
          baseURL: GHL_BASE_URL,
          timeout: 8000,
          headers: { Authorization: `Bearer ${plainKey}`, Version: GHL_API_VERSION },
          validateStatus: () => true,
        }),
      );
      return response.status !== 401 && response.status !== 403;
    } catch (err) {
      this.logger.warn(`GHL API key validation request failed: ${(err as Error).message}`);
      return false;
    }
  }

  /** AES-256-GCM encrypts a plaintext string. Returns "iv:authTag:ciphertext" (hex). */
  encryptKey(plaintext: string): string {
    const key = this.deriveEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /** Decrypts an AES-256-GCM ciphertext in "iv:authTag:ciphertext" format. */
  decryptKey(stored: string): string {
    const key = this.deriveEncryptionKey();
    const [ivHex, tagHex, encHex] = stored.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  /**
   * Derives a 32-byte key from the ENCRYPTION_KEY environment variable via SHA-256.
   * Throws if the variable is missing to prevent silent misconfiguration.
   */
  private deriveEncryptionKey(): Buffer {
    const raw = this.configService.get<string>('ENCRYPTION_KEY');
    if (!raw) throw new Error('ENCRYPTION_KEY environment variable is not configured');
    return crypto.createHash('sha256').update(raw).digest();
  }
}
