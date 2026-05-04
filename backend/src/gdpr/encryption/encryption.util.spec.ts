import { deriveFieldKey, encrypt, decrypt, isEncrypted, computeBlindIndex } from './encryption.util';
import { randomBytes } from 'crypto';

describe('encryption.util', () => {
  const masterKey = randomBytes(32);

  describe('deriveFieldKey', () => {
    it('produces a 32-byte key', () => {
      const key = deriveFieldKey(masterKey, 'Lead.phone');
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('produces different keys for different field contexts', () => {
      const keyA = deriveFieldKey(masterKey, 'Lead.phone');
      const keyB = deriveFieldKey(masterKey, 'Message.content');
      expect(keyA.equals(keyB)).toBe(false);
    });

    it('produces the same key for the same context (deterministic)', () => {
      const keyA = deriveFieldKey(masterKey, 'Lead.phone');
      const keyB = deriveFieldKey(masterKey, 'Lead.phone');
      expect(keyA.equals(keyB)).toBe(true);
    });
  });

  describe('encrypt / decrypt', () => {
    const key = deriveFieldKey(masterKey, 'Test.field');

    it('round-trips plaintext correctly', () => {
      const plaintext = 'CF10 1AA';
      const ciphertext = encrypt(plaintext, key);
      expect(decrypt(ciphertext, key)).toBe(plaintext);
    });

    it('produces different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'hello';
      const a = encrypt(plaintext, key);
      const b = encrypt(plaintext, key);
      expect(a).not.toBe(b);
    });

    it('handles empty string', () => {
      const ciphertext = encrypt('', key);
      expect(decrypt(ciphertext, key)).toBe('');
    });

    it('throws on tampered ciphertext', () => {
      const ciphertext = encrypt('secret', key);
      const parts = ciphertext.split(':');
      // Flip a character in the ciphertext portion
      parts[1] = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'A' ? 'B' : 'A');
      expect(() => decrypt(parts.join(':'), key)).toThrow();
    });

    it('throws on invalid format', () => {
      expect(() => decrypt('notvalid', key)).toThrow('Invalid encrypted value format');
    });
  });

  describe('isEncrypted', () => {
    const key = deriveFieldKey(masterKey, 'Test.field');

    it('returns true for encrypted values', () => {
      expect(isEncrypted(encrypt('hello', key))).toBe(true);
    });

    it('returns false for plaintext', () => {
      expect(isEncrypted('CF10 1AA')).toBe(false);
      expect(isEncrypted('john@example.com')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isEncrypted(null as any)).toBe(false);
      expect(isEncrypted(undefined as any)).toBe(false);
      expect(isEncrypted(123 as any)).toBe(false);
    });
  });

  describe('computeBlindIndex', () => {
    it('produces a hex string', () => {
      const hash = computeBlindIndex('07700900000', masterKey);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      const a = computeBlindIndex('07700900000', masterKey);
      const b = computeBlindIndex('07700900000', masterKey);
      expect(a).toBe(b);
    });

    it('produces different hashes for different inputs', () => {
      const a = computeBlindIndex('07700900000', masterKey);
      const b = computeBlindIndex('07700900001', masterKey);
      expect(a).not.toBe(b);
    });
  });
});
