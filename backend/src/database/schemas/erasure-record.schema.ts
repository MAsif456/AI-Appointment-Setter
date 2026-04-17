/**
 * ErasureRecord schema - compensating journal for right-to-erasure operations.
 *
 * Tracks per-collection progress during cross-collection anonymisation.
 * Enables idempotent resume from partial failures - critical because
 * MongoDB Atlas M0 does not support multi-document transactions.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ErasureRecordDocument = ErasureRecord & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ErasureRecord {
  /** String (not ObjectId) because the lead document will be anonymised. */
  @Prop({ required: true, index: true })
  originalLeadId: string;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true })
  clinicId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['in_progress', 'completed', 'partial_failure'],
    required: true,
  })
  status: string;

  @Prop({ required: true })
  requestedBy: string;

  /** Maps collection name > count of documents anonymised, e.g. { messages: 42 }. */
  @Prop({ type: Object, required: true, default: {} })
  collectionsProcessed: Record<string, number>;

  @Prop()
  errorDetails?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const ErasureRecordSchema = SchemaFactory.createForClass(ErasureRecord);

// originalLeadId index is already declared via @Prop({ index: true }) above.
ErasureRecordSchema.index({ clinicId: 1, createdAt: -1 });
