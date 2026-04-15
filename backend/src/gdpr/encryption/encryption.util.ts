/**
 * Application-level AES-256-GCM encryption utility.
 *
 * Chosen over MongoDB CSFLE because CSFLE requires the mongocryptd / crypt_shared
 * native binary on every machine (dev, CI, Render).  App-level encryption achieves
 * the same data-at-rest protection without infrastructure dependencies.
 *
 * AES-256-GCM is used instead of CBC because GCM provides authenticated encryption
 * (integrity + confidentiality) in a single operation, avoiding "encrypt-then-MAC"
 * implementation pitfalls.
 * Ref: NIST SP 800-38D — Recommendation for GCM Mode
 *   https://csrc.nist.gov/publications/detail/sp/800-38d/final
 *
 * Per-field key derivation uses HKDF (extract-and-expand) so that
 * compromising one field's ciphertext does not reveal the key for other fields.
 * Ref: IETF RFC 5869 — HMAC-based Extract-and-Expand Key Derivation Function
 *   https://datatracker.ietf.org/doc/html/rfc5869
 * Also endorsed by NIST SP 800-56C Rev. 2 for key-derivation methods.
 *   https://csrc.nist.gov/publications/detail/sp/800-56c/rev-2/final
 */
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';
import { hkdfSync } from 'crypto';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DERIVED_KEY_LENGTH = 32;

/**
 * Derives a 32-byte per-field encryption key using HKDF-SHA256.
 * @param masterKey - The 32-byte master key.
 * @param fieldContext - Unique context string, e.g. "Lead.phone" or "Message.content".
 */
export function deriveFieldKey(masterKey: Buffer, fieldContext: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', masterKey, Buffer.alloc(0), fieldContext, DERIVED_KEY_LENGTH),
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @returns Colon-delimited base64 string: "iv:ciphertext:authTag".
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${authTag.toString('base64')}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext string.
 * @param encryptedValue - Colon-delimited "iv:ciphertext:authTag" (all base64).
 * @throws If the auth tag verification fails (tampered data).
 */
export function decrypt(encryptedValue: string, key: Buffer): string {
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted value format');
  const iv = Buffer.from(parts[0], 'base64');
  const ciphertext = Buffer.from(parts[1], 'base64');
  const authTag = Buffer.from(parts[2], 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * Checks whether a value appears to already be encrypted (iv:ciphertext:authTag format).
 * Used to prevent double-encryption when documents are loaded, modified, and re-saved.
 */
export function isEncrypted(value: string): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  return parts.every((p) => /^[A-Za-z0-9+/]+=*$/.test(p) && p.length > 0);
}

/**
 * Computes an HMAC-SHA256 blind index for encrypted field lookups.
 * Allows querying by phone/email without storing plaintext, preserving O(1) lookups.
 */
export function computeBlindIndex(value: string, key: Buffer): string {
  return createHmac('sha256', key).update(value).digest('hex');
}
