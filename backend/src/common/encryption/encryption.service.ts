import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Reusable AES-256-GCM encryption service.
 * Wraps key derivation and cipher operations so any module can encrypt
 * sensitive strings (e.g. per-clinic GHL API keys) without duplicating
 * crypto logic.
 *
 * Encrypted format: {iv_hex}:{authTag_hex}:{ciphertext_hex}
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('ENCRYPTION_KEY');
    if (!raw || raw.length < 32) {
      throw new Error(
        'ENCRYPTION_KEY environment variable must be set and at least 32 characters long',
      );
    }
    // Derive a fixed-length 32-byte key via SHA-256 so any passphrase length works.
    this.key = crypto.createHash('sha256').update(raw).digest();
  }

  /**
   * Encrypts a plaintext string with AES-256-GCM.
   * A fresh random IV is generated per call so identical inputs produce
   * different ciphertexts.
   *
   * @param text - The plaintext string to encrypt.
   * @returns A colon-delimited hex string: "{iv}:{authTag}:{ciphertext}"
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts a string previously produced by {@link encrypt}.
   *
   * @param stored - The "{iv}:{authTag}:{ciphertext}" hex string.
   * @returns The original plaintext.
   * @throws If the stored value is malformed or the auth tag fails verification.
   */
  decrypt(stored: string): string {
    const parts = stored.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format — expected "iv:authTag:ciphertext"');
    }
    const [ivHex, tagHex, encHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
