import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { fieldEncryptionPlugin } from "../../gdpr/encryption/field-encryption.plugin";

export type PatientHistoryDocument = PatientHistory & Document;

/**
 * Stores one record per patient per clinic after a successful booking.
 * Used to identify returning patients at conversation start and skip
 * previously completed qualification steps.
 *
 * Compound indexes on { clinicId, phone } and { clinicId, email } ensure
 * fast lookups without cross-clinic bleed.
 */
@Schema({ timestamps: true })
export class PatientHistory {
  /** Clinic this history record belongs to — scopes all lookups. */
  @Prop({ type: Types.ObjectId, ref: "Clinic", required: true, index: true })
  clinicId: Types.ObjectId;

  /** Normalised phone number used as the primary lookup key. */
  @Prop({ required: true, trim: true })
  phone: string;

  /** Email address used as the secondary lookup key (optional). */
  @Prop({ lowercase: true, trim: true })
  email?: string;

  /** Lead's first name for personalised greeting generation. */
  @Prop({ required: true, trim: true })
  firstName: string;

  /** Lead's last name (optional). */
  @Prop({ trim: true })
  lastName?: string;

  /** The validated postcode from the most recent booking — loaded into context
   *  when a returning patient skips qualification. */
  @Prop({ trim: true, uppercase: true })
  validatedPostcode?: string;

  /** Reference to the conversation that resulted in the most recent booking. */
  @Prop({ type: Types.ObjectId, ref: "Conversation" })
  previousConversationId?: Types.ObjectId;

  /** Date of the most recent completed booking — used for stale data expiry checks. */
  @Prop({ required: true })
  lastBookedAt: Date;

  /** HMAC-SHA256 blind index of normalised phone — enables equality queries on encrypted phone. */
  @Prop({ trim: true })
  phoneHash?: string;

  // timestamps: createdAt, updatedAt (automatic)
}

export const PatientHistorySchema =
  SchemaFactory.createForClass(PatientHistory);

// Apply field-level encryption (UK GDPR Art. 5(1)(f) — integrity and confidentiality)
// Ref: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/the-principles/integrity-and-confidentiality-security/
if (process.env.FIELD_ENCRYPTION_KEY) {
  PatientHistorySchema.plugin(fieldEncryptionPlugin, {
    fields: ['phone', 'email'],
    encryptionKey: process.env.FIELD_ENCRYPTION_KEY,
    modelName: 'PatientHistory',
  });
}

// Primary lookup path: phoneHash replaces phone for encrypted-field lookups.
// unique: true means each patient has exactly one record per clinic — re-bookings upsert.
PatientHistorySchema.index({ clinicId: 1, phoneHash: 1 }, { unique: true });

// Secondary lookup path: email + clinic (medium-confidence match).
// sparse: true skips documents where email is absent.
PatientHistorySchema.index({ clinicId: 1, email: 1 }, { sparse: true });
