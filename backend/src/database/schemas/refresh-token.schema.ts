import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

/**
 * Persisted refresh token record.
 * One record exists per active refresh token in circulation.
 * Expired records are auto-deleted by the MongoDB TTL index on expiresAt.
 */
@Schema({ timestamps: false })
export class RefreshToken {
  /**
   * The user this token belongs to.
   * Indexed so revokeAll(userId) is a fast targeted deleteMany.
   */
  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  userId: Types.ObjectId;

  /**
   * HMAC-SHA256 of the raw 64-byte hex token string.
   * We never store the plaintext token — only the hash.
   * A stolen DB dump cannot be used to forge sessions.
   */
  @Prop({ required: true })
  tokenHash: string;

  /**
   * UUID shared by every token in one rotation chain (login → rotations).
   * Indexed so the entire family can be revoked in one deleteMany on reuse detection.
   */
  @Prop({ required: true, index: true })
  family: string;

  /**
   * Absolute UTC expiry timestamp.
   * MongoDB deletes this document automatically via the TTL index below.
   * Also checked in-code so we get a clean 'expired' error before the TTL fires.
   */
  @Prop({ required: true })
  expiresAt: Date;

  /**
   * Set to true once this token has been consumed (rotated).
   * If a used token arrives again it signals theft — revoke the whole family.
   */
  @Prop({ default: false })
  used: boolean;

  /**
   * Client IP at token creation.
   * Included in reuse-detection warning logs so the incident can be investigated.
   */
  @Prop()
  ipAddress?: string;

  /**
   * Client User-Agent at token creation.
   * Helps identify the device involved in a potential token theft event.
   */
  @Prop()
  userAgent?: string;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL index: MongoDB removes documents automatically once expiresAt is in the past.
// expireAfterSeconds: 0 means "delete as soon as the field timestamp is reached".
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
