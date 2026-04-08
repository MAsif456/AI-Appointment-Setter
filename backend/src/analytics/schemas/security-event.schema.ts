import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type SecurityEventDocument = SecurityEvent & Document;

/** Retention period for security events (30 days). */
const SECURITY_EVENT_TTL_SECONDS = 30 * 86_400;

/**
 * Structured security event log entry.
 * Captures rate limit breaches, login failures, account lockouts, and
 * other security-relevant events for dashboard visibility.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class SecurityEvent {
  /** Event type (e.g. "rate_limit_exceeded", "login_failed", "account_locked"). */
  @Prop({ required: true, index: true })
  eventType: string;

  /** Client IP address. */
  @Prop({ required: true })
  ip: string;

  /** Authenticated user ID, if available. */
  @Prop()
  userId?: string;

  /** Target email address (for auth events). */
  @Prop()
  email?: string;

  /** The endpoint path that triggered the event. */
  @Prop({ required: true })
  endpoint: string;

  /** Rate limit tier (auth, read, write). */
  @Prop()
  tier?: string;

  /** Requests remaining in the window when the event occurred. */
  @Prop()
  windowRemaining?: number;

  /** Additional context (e.g. contributing IPs for cross-IP lockout). */
  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;
}

export const SecurityEventSchema =
  SchemaFactory.createForClass(SecurityEvent);

// TTL: auto-delete after 30 days
SecurityEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: SECURITY_EVENT_TTL_SECONDS },
);
SecurityEventSchema.index({ eventType: 1, createdAt: -1 });
SecurityEventSchema.index({ ip: 1, createdAt: -1 });
SecurityEventSchema.index({ email: 1, createdAt: -1 });
