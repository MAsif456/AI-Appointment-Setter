import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type AppointmentDocument = Appointment & Document;

@Schema({ _id: false })
export class ReminderLog {
  @Prop({ required: true })
  sentAt: Date;

  @Prop({ required: true })
  type: string; // '24_hour', '1_hour', '48_hour', etc.

  @Prop({ type: String, enum: ["sent", "failed"], required: true })
  status: string;
}

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: "Clinic", required: true, index: true })
  clinicId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Lead", required: true, index: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Conversation" })
  conversationId?: Types.ObjectId;

  @Prop({ required: true })
  ghlAppointmentId: string; // ID in GHL calendar

  @Prop({ required: true, index: true })
  appointmentDate: Date;

  @Prop({ required: true })
  appointmentTime: string;

  @Prop({ required: true })
  durationMinutes: number;

  @Prop()
  serviceType?: string;

  @Prop()
  price?: number;

  @Prop({
    type: String,
    enum: ["confirmed", "rescheduled", "cancelled", "completed", "no_show"],
    default: "confirmed",
  })
  status: string;

  // Rescheduling tracking
  @Prop()
  previousAppointmentDate?: Date; // If rescheduled

  @Prop()
  rescheduledAt?: Date;

  @Prop({ default: 0 })
  rescheduleCount: number;

  // Cancellation tracking
  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;

  @Prop({ default: false })
  withinCancellationWindow: boolean; // True if cancelled with sufficient notice

  @Prop({ default: false })
  cancellationFeeApplied: boolean;

  // Completion tracking
  @Prop()
  completedAt?: Date;

  @Prop({ default: false })
  noShow: boolean;

  @Prop()
  markedNoShowAt?: Date;

  // Reminders
  @Prop({ type: [ReminderLog], default: [] })
  reminders: ReminderLog[];

  // Payment
  @Prop({ default: false })
  paymentRequired: boolean;

  @Prop()
  paymentAmount?: number;

  @Prop({
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  })
  paymentStatus?: string;

  @Prop()
  paymentCompletedAt?: Date;

  @Prop()
  paymentTransactionId?: string;

  // Notes
  @Prop()
  notes?: string;

  // Timestamps: createdAt, updatedAt
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

// Indexes
AppointmentSchema.index({ clinicId: 1, appointmentDate: 1 });
AppointmentSchema.index({ leadId: 1, appointmentDate: -1 });
AppointmentSchema.index({ ghlAppointmentId: 1 }, { unique: true });
AppointmentSchema.index({ status: 1, clinicId: 1 });
AppointmentSchema.index({ appointmentDate: 1, status: 1 }); // For reminder jobs
AppointmentSchema.index({ clinicId: 1, status: 1, createdAt: -1 }); // For analytics
