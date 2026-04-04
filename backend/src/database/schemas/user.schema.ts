import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

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

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt: Date;

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

  // Timestamps: createdAt, updatedAt (auto-generated)
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ isActive: 1 });