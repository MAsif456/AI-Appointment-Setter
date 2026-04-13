import { Schema } from 'mongoose';
import { fieldEncryptionPlugin } from './field-encryption.plugin';
import { isEncrypted, encrypt, deriveFieldKey } from './encryption.util';
import { randomBytes } from 'crypto';

const TEST_KEY = randomBytes(32).toString('hex');

/**
 * Helper: creates a schema with the plugin applied and returns hook executors.
 * Tests the plugin's hook logic in isolation — no database connection needed.
 */
function createTestSchema() {
  const schema = new Schema({ phone: String, email: String, name: String });
  schema.plugin(fieldEncryptionPlugin, {
    fields: ['phone', 'email'],
    encryptionKey: TEST_KEY,
    modelName: 'TestModel',
  });
  return schema;
}

/** Simulates a Mongoose document with get/set for hook testing. */
function fakeDoc(data: Record<string, any>) {
  const store = { ...data };
  return {
    get(field: string) { return store[field]; },
    set(field: string, value: any) { store[field] = value; },
    isModified: () => true,
    $locals: {} as any,
    _store: store,
  };
}

describe('fieldEncryptionPlugin', () => {
  describe('pre-save hook', () => {
    it('encrypts configured fields', () => {
      const schema = createTestSchema();
      const preSaveHooks = (schema as any).s.hooks._pres.get('save');
      expect(preSaveHooks.length).toBeGreaterThan(0);

      const doc = fakeDoc({ phone: '07700900000', email: 'j@t.com', name: 'John' });
      // Execute the pre-save hook
      preSaveHooks[0].fn.call(doc);

      expect(isEncrypted(doc._store.phone)).toBe(true);
      expect(isEncrypted(doc._store.email)).toBe(true);
      expect(doc._store.name).toBe('John'); // not configured — untouched
    });

    it('does not double-encrypt already encrypted values', () => {
      const schema = createTestSchema();
      const preSaveHooks = (schema as any).s.hooks._pres.get('save');
      const masterKey = Buffer.from(TEST_KEY, 'hex');
      const key = deriveFieldKey(masterKey, 'TestModel.phone');
      const alreadyEncrypted = encrypt('07700900000', key);

      const doc = fakeDoc({ phone: alreadyEncrypted });
      preSaveHooks[0].fn.call(doc);

      // Should still be the same encrypted value (not double-encrypted)
      expect(doc._store.phone).toBe(alreadyEncrypted);
    });

    it('skips null/undefined fields', () => {
      const schema = createTestSchema();
      const preSaveHooks = (schema as any).s.hooks._pres.get('save');

      const doc = fakeDoc({ phone: undefined, email: null });
      // Should not throw
      expect(() => preSaveHooks[0].fn.call(doc)).not.toThrow();
    });

    it('skips empty string fields', () => {
      const schema = createTestSchema();
      const preSaveHooks = (schema as any).s.hooks._pres.get('save');

      const doc = fakeDoc({ phone: '', email: '' });
      preSaveHooks[0].fn.call(doc);

      expect(doc._store.phone).toBe('');
      expect(doc._store.email).toBe('');
    });
  });

  describe('post-find hooks', () => {
    it('decrypts configured fields in a single document', () => {
      const schema = createTestSchema();
      const postFindOneHooks = (schema as any).s.hooks._posts.get('findOne');
      expect(postFindOneHooks.length).toBeGreaterThan(0);

      const masterKey = Buffer.from(TEST_KEY, 'hex');
      const phoneKey = deriveFieldKey(masterKey, 'TestModel.phone');
      const emailKey = deriveFieldKey(masterKey, 'TestModel.email');
      const encPhone = encrypt('07700900000', phoneKey);
      const encEmail = encrypt('j@t.com', emailKey);

      const doc = fakeDoc({ phone: encPhone, email: encEmail, name: 'John' });
      postFindOneHooks[0].fn.call(null, doc);

      expect(doc._store.phone).toBe('07700900000');
      expect(doc._store.email).toBe('j@t.com');
      expect(doc._store.name).toBe('John');
    });

    it('decrypts documents in an array (post-find)', () => {
      const schema = createTestSchema();
      const postFindHooks = (schema as any).s.hooks._posts.get('find');

      const masterKey = Buffer.from(TEST_KEY, 'hex');
      const phoneKey = deriveFieldKey(masterKey, 'TestModel.phone');

      const docs = [
        fakeDoc({ phone: encrypt('111', phoneKey) }),
        fakeDoc({ phone: encrypt('222', phoneKey) }),
      ];

      postFindHooks[0].fn.call(null, docs);

      expect(docs[0]._store.phone).toBe('111');
      expect(docs[1]._store.phone).toBe('222');
    });

    it('handles null document gracefully', () => {
      const schema = createTestSchema();
      const postFindOneHooks = (schema as any).s.hooks._posts.get('findOne');
      expect(() => postFindOneHooks[0].fn.call(null, null)).not.toThrow();
    });
  });

  describe('pre-findOneAndUpdate hook', () => {
    it('encrypts $set fields', () => {
      const schema = createTestSchema();
      const preHooks = (schema as any).s.hooks._pres.get('findOneAndUpdate');
      expect(preHooks.length).toBeGreaterThan(0);

      const update = { $set: { phone: '07700900000', name: 'John' } };
      const ctx = { getUpdate: () => update };
      preHooks[0].fn.call(ctx);

      expect(isEncrypted(update.$set.phone)).toBe(true);
      expect(update.$set.name).toBe('John'); // not configured
    });

    it('does not encrypt already-encrypted $set values', () => {
      const schema = createTestSchema();
      const preHooks = (schema as any).s.hooks._pres.get('findOneAndUpdate');
      const masterKey = Buffer.from(TEST_KEY, 'hex');
      const key = deriveFieldKey(masterKey, 'TestModel.phone');
      const encrypted = encrypt('07700900000', key);

      const update = { $set: { phone: encrypted } };
      const ctx = { getUpdate: () => update };
      preHooks[0].fn.call(ctx);

      expect(update.$set.phone).toBe(encrypted);
    });
  });
});
