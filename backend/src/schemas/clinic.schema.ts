import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ClinicDocument = Clinic & Document;

// Embedded schemas
@Schema({ _id: false })
export class BusinessHours {
  @Prop({ required: true })
  day: string; // 'monday', 'tuesday', etc.

  @Prop({ required: true })
  isOpen: boolean;

  @Prop()
  openTime?: string; // '09:00'

  @Prop()
  closeTime?: string; // '17:00'
}

@Schema({ _id: false })
export class AIConfiguration {
  @Prop({ type: String, enum: ['friendly', 'professional', 'balanced'], default: 'professional' })
  tone: string;

  @Prop({ default: 'Hi {{firstName}}! Thanks for getting in touch with {{clinicName}}. I can help you book an appointment for your {{issue}}. Let me ask a few quick questions.' })
  greetingTemplate: string;

  @Prop({ type: [String], default: [] })
  customInstructions: string[];

  @Prop({ 
    type: Map, 
    of: Boolean,
    default: {
      postcode: true,
      urgency: true,
      preferredTime: true,
      serviceType: false
    }
  })
  qualificationQuestions: Map<string, boolean>;

  // FAQ Responses
  @Prop({ type: [{ question: String, answer: String }], default: [] })
  faqResponses: Array<{ question: string; answer: string }>;
}

@Schema({ _id: false })
export class ServiceArea {
  @Prop({ required: true })
  postcodePrefix: string; 

  @Prop()
  description?: string;
}

@Schema({ _id: false })
export class Service {
  @Prop({ required: true })
  name: string;

  @Prop({ default: 20 })
  durationMinutes: number;

  @Prop()
  price?: number;

  @Prop()
  description?: string;
}

@Schema({ _id: false })
export class ReminderSettings {
  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: [Number], default: [24, 1] }) // hours before appointment
  reminderTimes: number[];
}

@Schema({ _id: false })
export class FollowUpSettings {
  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: 3 })
  maxFollowUps: number;

  @Prop({ type: [Number], default: [48, 96, 144] }) // 48h, 96h (4 days), 144h (6 days)
  followUpIntervals: number[];
}

@Schema({ _id: false })
export class CancellationPolicy {
  @Prop({ default: false })
  feeEnabled: boolean;

  @Prop()
  feeAmount?: number;

  @Prop({ default: 24 })
  noticeHours: number; 
}

@Schema({ timestamps: true })
export class Clinic {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  ghlLocationId: string;

  @Prop({ required: true, trim: true })
  ghlCalendarId: string;

  @Prop({ trim: true })
  ghlApiKey?: string; 

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  email?: string;

  @Prop({ type: [ServiceArea], default: [] })
  serviceAreas: ServiceArea[];

  @Prop({ type: [Service], default: [] })
  services: Service[];

  @Prop({ type: [BusinessHours], default: [] })
  businessHours: BusinessHours[];

  @Prop({ type: AIConfiguration, default: () => ({}) })
  aiConfig: AIConfiguration;

  @Prop({ type: ReminderSettings, default: () => ({}) })
  reminderSettings: ReminderSettings;

  @Prop({ type: FollowUpSettings, default: () => ({}) })
  followUpSettings: FollowUpSettings;

  @Prop({ type: CancellationPolicy, default: () => ({}) })
  cancellationPolicy: CancellationPolicy;

  @Prop({ default: 20 })
  defaultAppointmentDuration: number;

  @Prop({ default: false })
  paymentEnabled: boolean;

  @Prop()
  paymentInstructions?: string;

  @Prop()
  itemsToBring?: string; 

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  deactivatedAt?: Date;

  @Prop()
  deactivatedBy?: string; // User ID who deactivated

  // denormalized stats for dashboard (updated via aggregation)
  @Prop({ default: 0 })
  todayLeadsCount: number;

  @Prop({ default: 0 })
  todayBookingsCount: number;

  @Prop({ default: 0 })
  monthLeadsCount: number;

  @Prop({ default: 0 })
  monthBookingsCount: number;

  // Timestamps: createdAt, updatedAt
}

export const ClinicSchema = SchemaFactory.createForClass(Clinic);

// Indexes
ClinicSchema.index({ ghlLocationId: 1 });
ClinicSchema.index({ isActive: 1 });
ClinicSchema.index({ name: 1 });