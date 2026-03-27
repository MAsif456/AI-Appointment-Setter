import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

/**
 * User schema for Lunax Digital staff accounts.
 * Supports two roles: 'admin' (full access) and 'staff' (assigned clinics only).
 */

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, enum: ['admin', 'staff'], default: 'staff' })
  role: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Clinic' }], default: [] })
  assignedClinics: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  // Notification preferences (for Settings page)
  @Prop({ 
  type: {
    emailNotifications: { type: Boolean, default: true },
    dailySummary: { type: Boolean, default: true },
    stalled: { type: Boolean, default: true }
  },
  default: {
    emailNotifications: true,
    dailySummary: true,
    stalled: true
  }
  })
  notificationPreferences: {
    emailNotifications: boolean;
    dailySummary: boolean;
    stalled: boolean;
  };

  @Prop({ default: false })
  isVerified: boolean;

  @Prop()
  verificationToken?: string;
  
  @Prop()
  verificationTokenExpires?: Date;
 
  @Prop()
  passwordResetToken?: string;
 
  @Prop()
  passwordResetExpires?: Date;
 
  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ verificationToken: 1 }, { sparse: true });
UserSchema.index({ passwordResetToken: 1 }, { sparse: true });