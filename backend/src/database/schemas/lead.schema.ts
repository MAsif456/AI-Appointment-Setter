import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { fieldEncryptionPlugin } from "../../gdpr/encryption/field-encryption.plugin";

export type LeadDocument = Lead & Document;

@Schema({ _id: false })
export class ConsentRecord {
  @Prop({ required: true })
  optedIn: boolean;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop()
  optedOutAt?: Date;
}

@Schema({ timestamps: true })
export class Lead {
  @Prop({ type: Types.ObjectId, ref: "Clinic", required: true, index: true })
  clinicId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop({ trim: true, default: "unknown" })
  phone?: string;

  // Note: lowercase removed — it corrupts AES-256-GCM base64 ciphertext by
  // converting uppercase letters, making the auth tag fail on decryption.
  // Email normalisation is handled in the pre-save hook below instead.
  @Prop({ trim: true })
  email?: string;

  @Prop({ trim: true, uppercase: true })
  postcode?: string;

  @Prop({
    type: String,
    enum: ["valid", "invalid", "not_checked"],
    default: "not_checked",
  })
  postcodeStatus: string;

  @Prop({ trim: true })
  issue?: string;

  @Prop({
    type: String,
    enum: ["urgent", "routine", "unknown"],
    default: "unknown",
  })
  urgency: string;

  @Prop({ type: String, enum: ["new", "returning"], default: "new" })
  patientType: string;

  @Prop()
  serviceType?: string;

  // Lead Source (for analytics)
  @Prop({
    type: String,
    enum: [
      "facebook",
      "instagram",
      "google_ads",
      "website",
      "referral",
      "whatsapp_direct",
      "other",
    ],
    required: true,
  })
  leadSource: string;

  @Prop({
    type: String,
    enum: ["sms", "whatsapp", "facebook", "instagram", "website", "email"],
    required: true,
  })
  preferredChannel: string;

  @Prop({ trim: true })
  ghlContactId?: string; // ID in GHL system

  @Prop({ type: [String], default: [] })
  ghlTags: string[]; // Tags applied in GHL

  @Prop({ type: ConsentRecord })
  consent?: ConsentRecord;

  @Prop({ default: 0 })
  totalAppointments: number;

  @Prop({ default: 0 })
  cancelledAppointments: number;

  @Prop({ default: 0 })
  noShows: number;

  @Prop()
  lastAppointmentAt?: Date;

  /** HMAC-SHA256 blind index of normalised phone — enables equality queries on encrypted phone field. */
  @Prop({ trim: true })
  phoneHash?: string;

  @Prop({ type: Map, of: String, default: {} })
  customFields: Map<string, string>; // for future needs

  // Timestamps: createdAt, updatedAt
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

// Normalise email to lowercase before encryption — replaces the Mongoose
// `lowercase: true` schema option which cannot be used on encrypted fields
// because it corrupts base64 ciphertext.  Registered BEFORE the encryption
// plugin so Mongoose executes this hook first (hooks run in registration order).
LeadSchema.pre('save', function () {
  const email = this.get('email');
  if (typeof email === 'string') {
    this.set('email', email.toLowerCase());
  }
});

// Apply field-level encryption (UK GDPR Art. 5(1)(f) — integrity and confidentiality)
// Ref: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/the-principles/integrity-and-confidentiality-security/
if (process.env.FIELD_ENCRYPTION_KEY) {
  LeadSchema.plugin(fieldEncryptionPlugin, {
    fields: ['phone', 'email', 'issue'],
    encryptionKey: process.env.FIELD_ENCRYPTION_KEY,
    modelName: 'Lead',
  });
}

// Indexes - phoneHash replaces phone for encrypted-field lookups
LeadSchema.index(
  { clinicId: 1, phoneHash: 1 },
  { unique: true, partialFilterExpression: { phoneHash: { $type: "string" } } },
);
LeadSchema.index({ clinicId: 1, email: 1 }, { unique: true, sparse: true });
LeadSchema.index({ ghlContactId: 1 });
LeadSchema.index({ clinicId: 1, createdAt: -1 });
LeadSchema.index({ clinicId: 1, leadSource: 1 });
LeadSchema.index({ postcode: 1 });
