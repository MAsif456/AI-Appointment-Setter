/**
 * ConsentRecord schema - immutable audit trail for GDPR consent events.
 *
 * Stored in a separate collection (not embedded in Lead) because:
 *   1. ICO Art. 7(1): Controllers must demonstrate consent was given.
 *      Embedded subdocuments are overwritten on update, destroying the trail.
 *      Ref: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/
 *   2. Erasure independence: Lead PII is anonymised on erasure, but consent
 *      records are retained as proof of lawful processing (Recital 42).
 *      Ref: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
 *   3. Each event stores the full statement text + version for audit.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConsentRecordDocument = ConsentRecordEntry & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ConsentRecordEntry {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true, index: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true, index: true })
  clinicId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation' })
  conversationId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['granted', 'declined', 'withdrawn'],
    required: true,
  })
  status: string;

  @Prop({ required: true })
  consentStatementVersion: string;

  @Prop({ required: true })
  consentStatementText: string;

  @Prop({
    type: String,
    enum: ['sms', 'whatsapp', 'facebook', 'instagram', 'website', 'email'],
    required: true,
  })
  channel: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const ConsentRecordSchema = SchemaFactory.createForClass(ConsentRecordEntry);

ConsentRecordSchema.index({ leadId: 1, createdAt: -1 });
ConsentRecordSchema.index({ clinicId: 1, status: 1, createdAt: -1 });
