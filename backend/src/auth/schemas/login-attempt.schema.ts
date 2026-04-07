import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type LoginAttemptDocument = LoginAttempt & Document;

/**
 * Tracks failed login attempts per IP address and per account (email).
 * IP keys use the format "ip:<address>", account keys use "account:<email>".
 * TTL index on expiresAt auto-removes stale records after the 15-min window.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class LoginAttempt {
  /** Composite key: "ip:<address>" or "account:<email>". */
  @Prop({ required: true, unique: true, index: true })
  key: string;

  /** Number of failed login attempts in the current window. */
  @Prop({ required: true, default: 0 })
  failureCount: number;

  /** Start of the current tracking window. */
  @Prop({ required: true })
  windowStart: Date;

  /** When this record should be removed by MongoDB TTL. */
  @Prop({ required: true })
  expiresAt: Date;
}

export const LoginAttemptSchema = SchemaFactory.createForClass(LoginAttempt);

/** Auto-delete expired login attempt records. */
LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
