import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type UserDocument = User & Document;

/**
 * User schema for Lunax Digital staff accounts.
 * Supports two roles: 'admin' (full access) and 'staff' (assigned clinics only).
 * isSuperAdmin is set only on the initial seeded admin. This account can
 * never be demoted or deleted regardless of how many other admins exist,
 * guaranteeing there is always a way back into the system. */

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, enum: ["admin", "staff"], default: "staff" })
  role: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Clinic' }], default: [] })
  assignedClinics: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  // Notification preferences (for Settings page)
  @Prop({
    type: {
      _id: false,
      generalNotifications: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      stalledConversations: { type: Boolean, default: true },
      escalatedConversations: { type: Boolean, default: true },
      bookingCancelled: { type: Boolean, default: true },
      newUserJoined: { type: Boolean, default: true },
      appointmentReminders: { type: Boolean, default: true },
    },
    default: {
      generalNotifications: true,
      emailNotifications: true,
      stalledConversations: true,
      escalatedConversations: true,
      bookingCancelled: true,
      newUserJoined: true,
      appointmentReminders: true,
    },
  })
  notificationPreferences: {
    generalNotifications: boolean;
    emailNotifications: boolean;
    stalledConversations: boolean;
    escalatedConversations: boolean;
    bookingCancelled: boolean;
    newUserJoined: boolean;
    appointmentReminders: boolean;
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

  @Prop({ default: 0 })
  tokenVersion: number;

  @Prop({ default: false })
  isSuperAdmin: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes — email index already created by @Prop({ unique: true }) above.
UserSchema.index({ isActive: 1 });
UserSchema.index({ verificationToken: 1 }, { sparse: true });
UserSchema.index({ passwordResetToken: 1 }, { sparse: true });
