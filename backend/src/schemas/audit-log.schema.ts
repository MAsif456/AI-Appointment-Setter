import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Clinic' })
  clinicId?: Types.ObjectId;

  @Prop({ required: true })
  action: string; // 'clinic.created', 'appointment.booked', 'conversation.escalated', etc.

  @Prop({ required: true })
  entityType: string; // 'clinic', 'appointment', 'conversation', 'message', 'user', etc.

  @Prop()
  entityId?: string;

  @Prop({ type: Object })
  changes?: Record<string, any>; // Before/after values for updates

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: String, enum: ['info', 'warning', 'error'], default: 'info' })
  severity: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Additional context

  // Only createdAt timestamp
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes
AuditLogSchema.index({ clinicId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ severity: 1, createdAt: -1 });