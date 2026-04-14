/**
 * Mongoose plugin for transparent field-level encryption.
 *
 * Applied at the schema level so every save/find operation automatically
 * encrypts/decrypts configured fields.  This prevents call-sites from
 * needing to remember to encrypt manually — a guaranteed source of bugs.
 *
 * Follows the existing codebase convention for Mongoose hooks
 * (see message.schema.ts pre-save hook for aiProcessingTimeMs).
 */
import { Schema } from 'mongoose';
import { deriveFieldKey, encrypt, decrypt, isEncrypted } from './encryption.util';

export interface FieldEncryptionOptions {
  /** Field names to encrypt, e.g. ['phone', 'email', 'issue']. */
  fields: string[];
  /** Hex-encoded 32-byte master key from environment. */
  encryptionKey: string;
  /** Model name used as HKDF context, e.g. 'Lead'. */
  modelName: string;
}

/**
 * Mongoose plugin that encrypts specified fields on save and decrypts on read.
 */
export function fieldEncryptionPlugin(
  schema: Schema,
  options: FieldEncryptionOptions,
): void {
  const { fields, encryptionKey, modelName } = options;
  const masterKey = Buffer.from(encryptionKey, 'hex');

  const keyCache = new Map<string, Buffer>();
  /**
   * Retrieves the field-specific encryption key from the cache or derives it
   * if not present.  The key is derived from the master key and the field name
   * using HKDF-SHA256.  The field name is prefixed with the model name to ensure
   * uniqueness across models.
   * @param field - The name of the field to get the encryption key for.
   * @returns The field-specific encryption key as a Buffer.
   */
  function getKey(field: string): Buffer {
    if (!keyCache.has(field)) {
      keyCache.set(field, deriveFieldKey(masterKey, `${modelName}.${field}`));
    }
    return keyCache.get(field)!;
  }

  // Encrypt on save
  schema.pre('save', function () {
    for (const field of fields) {
      const value = this.get(field);
      if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
        this.set(field, encrypt(value, getKey(field)));
      }
    }
  });

  // Encrypt fields in $set operations
  schema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate() as Record<string, any> | null;
    if (!update) return;
    const setOp = update.$set ?? update;
    for (const field of fields) {
      const value = setOp[field];
      if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
        setOp[field] = encrypt(value, getKey(field));
      }
    }
  });

  // Decrypt after queries
  function decryptFields(doc: any): void {
    if (!doc) return;
    for (const field of fields) {
      const value = doc[field] ?? doc.get?.(field);
      if (typeof value === 'string' && isEncrypted(value)) {
        try {
          const plaintext = decrypt(value, getKey(field));
          if (typeof doc.set === 'function') {
            doc.set(field, plaintext);
            doc.$locals = doc.$locals ?? {};
            doc.$locals.__decrypted = true;
          } else {
            doc[field] = plaintext;
          }
        } catch {
          // If current key fails, try previous key for key rotation support
          // Controlled by FIELD_ENCRYPTION_KEY_PREVIOUS env var
          const prevKeyHex = process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
          if (prevKeyHex) {
            const prevMaster = Buffer.from(prevKeyHex, 'hex');
            const prevKey = deriveFieldKey(prevMaster, `${modelName}.${field}`);
            const plaintext = decrypt(value, prevKey);
            if (typeof doc.set === 'function') {
              doc.set(field, plaintext);
              doc.$locals = doc.$locals ?? {};
              doc.$locals.__decrypted = true;
            } else {
              doc[field] = plaintext;
            }
          }
        }
      }
    }
  }

  // Decrypt using post('init') — a document middleware that fires every time a
  // document is hydrated from the database. Unlike post('find')/post('findOne')
  // (query middleware), post('init') fires reliably for ALL access patterns:
  // find, findOne, findById, populate, and aggregation with $lookup.
  // This is the approach used by the mongoose-field-encryption package.
  // Ref: https://mongoosejs.com/docs/middleware.html (Document middleware: init)
  schema.post('init', function () {
    decryptFields(this);
  });
}
