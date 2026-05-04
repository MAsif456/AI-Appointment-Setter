import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type IdempotencyKeyDocument = IdempotencyKey & Document;

/**
 * Stores idempotency keys and their cached responses to prevent duplicate
 * appointment bookings caused by network retries or double-submissions.
 *
 * Implements the Idempotency-Key pattern (IETF draft-ietf-httpapi-idempotency-key-header).
 * Keys auto-expire after 24 hours via a MongoDB TTL index.
 */
@Schema({ timestamps: true })
export class IdempotencyKey {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ required: true })
  payloadHash: string;

  @Prop({ type: Object, required: true })
  response: Record<string, any>;

  @Prop({ required: true, default: () => new Date() })
  createdAt: Date;
}

export const IdempotencyKeySchema =
  SchemaFactory.createForClass(IdempotencyKey);

// Auto-expire keys after 24 hours
IdempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86_400 });
