import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type RateLimitCounterDocument = RateLimitCounter & Document;

/**
 * Stores rate limit counters for each unique key (tier + method + identifier).
 * TTL index on expiresAt ensures automatic cleanup of stale counters.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class RateLimitCounter {
  /** Composite key: e.g. "read:GET:ip_192.168.1.1" or "write:POST:user_507f". */
  @Prop({ required: true, unique: true, index: true })
  key: string;

  /** Number of requests recorded in the current window. */
  @Prop({ required: true, default: 0 })
  count: number;

  /** Start of the current rate limit window. */
  @Prop({ required: true })
  windowStart: Date;

  /** When this counter document should be removed by MongoDB TTL. */
  @Prop({ required: true })
  expiresAt: Date;
}

export const RateLimitCounterSchema =
  SchemaFactory.createForClass(RateLimitCounter);

// TTL index: MongoDB removes documents once expiresAt is reached.
RateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
