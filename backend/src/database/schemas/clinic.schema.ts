import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

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

/** A single qualification question that the AI can ask during conversations. */
@Schema({ _id: false })
export class QualificationQuestion {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  label: string;

  @Prop({ default: true })
  enabled: boolean;
}

/** AI configuration settings controlling how the AI interacts with patients for a clinic. */
@Schema({ _id: false })
export class AIConfiguration {
  @Prop({
    type: String,
    enum: ["friendly", "professional", "balanced"],
    default: "friendly",
  })
  tone: string;

  @Prop({
    default:
      "Hi {{firstName}}! Thanks for getting in touch with {{clinicName}}. I can help you book an appointment. Let me ask a few quick questions.",
    maxlength: 500,
  })
  greetingTemplate: string;

  /** Optional greeting template used when a returning patient is detected.
   *  Supports the same {{placeholder}} variables as greetingTemplate. */
  @Prop({ maxlength: 500 })
  returningPatientGreetingTemplate?: string;

  /** Number of days before a patient history record is considered stale.
   *  When stale, the system still recognises the patient but flags the data
   *  for re-confirmation rather than skipping qualification silently. */
  @Prop({ default: 365, min: 1 })
  patientDataExpiryDays: number;

  @Prop({
    type: [QualificationQuestion],
    default: [
      { key: "urgency", label: "Urgency", enabled: true },
      { key: "preferredTime", label: "Preferred time of day", enabled: true },
      { key: "painDescription", label: "Pain description", enabled: true },
      { key: "patientType", label: "New or returning patient", enabled: true },
    ],
  })
  qualificationQuestions: QualificationQuestion[];

  @Prop({ default: "", maxlength: 1000 })
  customInstructions: string;

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
  @Prop()
  feeDescription?: string; // Human-readable fee, e.g. "£50" or "50%"
  @Prop({ default: 24 })
  noticeHours: number;
  @Prop({ maxlength: 500 })
  cancellationMessage?: string; // Optional warning template with {{placeholders}}
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
  webhookUrl?: string;

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

  /** UK GDPR Art. 5(1)(e) - configurable retention period per clinic (months).
   *  After this period, inactive lead data is automatically anonymised. */
  @Prop({ default: 12, min: 1 })
  dataRetentionMonths: number;

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

// Indexes (ghlLocationId already indexed via unique: true on the @Prop)
ClinicSchema.index({ isActive: 1 });
ClinicSchema.index({ name: 1 });
