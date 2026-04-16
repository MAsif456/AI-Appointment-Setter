/**
 * ErasureRequest schema — approval workflow for right-to-erasure operations.
 *
 * Staff members request deletion; admins approve or reject. This prevents
 * insider threats where a rogue staff member could mass-delete patient data.
 *
 * Ref: ICO Right to Erasure — organisational measures
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
 * Ref: OWASP Broken Access Control (A01:2021) — least privilege
 *   https://owasp.org/Top10/A01_2021-Broken_Access_Control/
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ErasureRequestDocument = ErasureRequest & Document;

@Schema({ timestamps: true })
export class ErasureRequest {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true })
  clinicId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: string;

  /** Email of the staff member who requested the erasure. */
  @Prop({ required: true })
  requestedBy: string;

  /** Email of the admin who approved or rejected (null while pending). */
  @Prop()
  reviewedBy?: string;

  /** Reason the staff member gave for requesting erasure. */
  @Prop({ required: true })
  reason: string;

  /** Admin's note when rejecting a request. */
  @Prop()
  rejectionReason?: string;

  @Prop()
  reviewedAt?: Date;
}

export const ErasureRequestSchema = SchemaFactory.createForClass(ErasureRequest);

ErasureRequestSchema.index({ clinicId: 1, status: 1, createdAt: -1 });
ErasureRequestSchema.index({ leadId: 1, status: 1 });
