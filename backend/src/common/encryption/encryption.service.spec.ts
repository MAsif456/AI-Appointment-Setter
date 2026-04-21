import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

/** Returns a ConfigService stub that always returns the given key. */
function makeModule(encryptionKey: string): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      EncryptionService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(encryptionKey) },
      },
    ],
  }).compile();
}

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module = await makeModule('test-encryption-key-32-chars-min!!');
    service = module.get<EncryptionService>(EncryptionService);
  });

  // ─── Construction ──────────────────────────────────────────────────────────

  describe('construction', () => {
    it('initialises successfully with a key ≥32 chars', () => {
      expect(service).toBeDefined();
    });

    it('throws when ENCRYPTION_KEY is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EncryptionService,
            { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
          ],
        }).compile(),
      ).rejects.toThrow('ENCRYPTION_KEY');
    });

    it('throws when ENCRYPTION_KEY is shorter than 32 chars', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EncryptionService,
            { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('tooshort') } },
          ],
        }).compile(),
      ).rejects.toThrow('ENCRYPTION_KEY');
    });
  });

  // ─── encrypt ───────────────────────────────────────────────────────────────

  describe('encrypt', () => {
    it('returns a non-empty string', () => {
      expect(service.encrypt('hello')).toBeTruthy();
    });

    it('returns a string in iv:authTag:ciphertext format', () => {
      const parts = service.encrypt('test').split(':');
      expect(parts).toHaveLength(3);
      parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/));
    });

    it('produces different output each time (random IV)', () => {
      const a = service.encrypt('same-plaintext');
      const b = service.encrypt('same-plaintext');
      expect(a).not.toBe(b);
    });

    it('handles empty string input', () => {
      expect(() => service.encrypt('')).not.toThrow();
    });

    it('handles long strings', () => {
      const long = 'a'.repeat(2000);
      expect(() => service.encrypt(long)).not.toThrow();
    });

    it('handles special characters', () => {
      const special = '🔑 p@ssw0rd! <script>alert(1)</script>';
      const encrypted = service.encrypt(special);
      expect(encrypted.split(':')).toHaveLength(3);
    });
  });

  // ─── decrypt ───────────────────────────────────────────────────────────────

  describe('decrypt', () => {
    it('reverses encrypt correctly', () => {
      const original = 'my-secret-api-key';
      expect(service.decrypt(service.encrypt(original))).toBe(original);
    });

    it('round-trips empty string', () => {
      expect(service.decrypt(service.encrypt(''))).toBe('');
    });

    it('round-trips long strings', () => {
      const long = 'x'.repeat(2000);
      expect(service.decrypt(service.encrypt(long))).toBe(long);
    });

    it('round-trips special characters', () => {
      const special = '🔑 p@ssw0rd! <script>alert(1)</script>';
      expect(service.decrypt(service.encrypt(special))).toBe(special);
    });

    it('throws on malformed input (not 3 parts)', () => {
      expect(() => service.decrypt('onlytwoparts:here')).toThrow();
    });

    it('throws when auth tag is tampered', () => {
      const encrypted = service.encrypt('sensitive');
      const [iv, , ciphertext] = encrypted.split(':');
      const tampered = `${iv}:${'00'.repeat(16)}:${ciphertext}`;
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws when ciphertext is tampered', () => {
      const encrypted = service.encrypt('sensitive');
      const parts = encrypted.split(':');
      parts[2] = '00'.repeat(parts[2].length / 2);
      expect(() => service.decrypt(parts.join(':'))).toThrow();
    });
  });

  // ─── key isolation ─────────────────────────────────────────────────────────

  describe('key isolation', () => {
    it('cannot decrypt ciphertext produced by a different key', async () => {
      const moduleB = await makeModule('different-encryption-key-32chars!');
      const serviceB = moduleB.get<EncryptionService>(EncryptionService);

      const ciphertext = service.encrypt('secret');
      expect(() => serviceB.decrypt(ciphertext)).toThrow();
    });
  });
});
