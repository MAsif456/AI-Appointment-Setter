import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ _id: false })
export class OfferedSlot {
  @Prop({ required: true })
  dateTime: Date;

  @Prop({ required: true })
  displayText: string; // 'Tuesday at 2pm'
}

@Schema({ _id: false })
export class PatientRating {
  @Prop({ required: true, min: 1, max: 5 })
  stars: number; 

  @Prop()
  feedback?: string;

  @Prop({ required: true })
  ratedAt: Date;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true, index: true })
  clinicId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true, index: true })
  leadId: Types.ObjectId;

  @Prop({ trim: true, index: true })
  ghlContactId?: string;

  @Prop({ trim: true, index: true })
  ghlConversationId?: string;

  @Prop({ 
    type: String, 
    enum: ['greeting', 'qualifying', 'qualified', 'booking', 'booked', 'confirmed', 'rescheduling', 'cancelled', 'declined', 'stalled', 'closed', 'escalated'], 
    default: 'greeting' 
  })
  phase: string;

  @Prop({ type: String, enum: ['sms', 'whatsapp', 'facebook', 'instagram', 'website'], required: true })
  channel: string;

  @Prop({ default: 0 })
  messageCount: number;

  @Prop({ required: true })
  startedAt: Date;

  @Prop()
  lastMessageAt: Date;

  @Prop()
  lastMessageFrom?: string; // 'lead' or 'ai'

  // High Priority / Emergency Flags 
  @Prop({ default: false })
  isHighPriority: boolean; 

  @Prop({ default: false })
  isEmergency: boolean; 

  @Prop({ default: false })
  requiresHumanIntervention: boolean; 

  @Prop()
  humanInterventionReason?: string;

  @Prop()
  escalatedAt?: Date;

  @Prop()
  escalationReason?: string;

  // Follow-up tracking
  @Prop({ default: 0 })
  followUpCount: number;

  @Prop()
  nextFollowUpAt?: Date;

  // Slot offering
  @Prop({ type: [OfferedSlot], default: [] })
  offeredSlots: OfferedSlot[];

  /** Cumulative history of ALL slots offered across all turns — used for prompt context */
  @Prop({ type: [OfferedSlot], default: [] })
  slotHistory: OfferedSlot[];

  /** When true, the AI has shown a day-level overview (Mon–Fri) and is waiting
   *  for the lead to pick a specific day before offering time slots. */
  @Prop({ default: false })
  awaitingDaySelection: boolean;

  /** The day name the lead last asked about (e.g. "thursday") — used to scope
   *  follow-up time preference requests to the correct day. */
  @Prop()
  lastRequestedDay?: string;

  /** The start of the date range last fetched for slots — used to scope
   *  follow-up time preference requests to the correct date range. */
  @Prop()
  lastRequestedDateStart?: Date;

  /** The end of the date range last fetched for slots. */
  @Prop()
  lastRequestedDateEnd?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Appointment' })
  appointmentId?: Types.ObjectId;

  // Patient Rating 
  @Prop({ type: PatientRating })
  patientRating?: PatientRating;

  // Conversation context/state
  @Prop({ type: Map, of: String, default: {} })
  context: Map<string, string>; 

  // for closure tracking
  @Prop()
  closedAt?: Date;

  @Prop()
  closedReason?: string; // eg. 'booked', 'declined', 'no_response', 'cancelled'

  // Flag for review (for "Flag for Review" button)
  @Prop({ default: false })
  flaggedForReview: boolean;

  @Prop()
  flaggedAt?: Date;

  @Prop()
  flaggedBy?: string; // User ID

  @Prop()
  flagReason?: string;

  // Timestamps: createdAt, updatedAt
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes
ConversationSchema.index({ clinicId: 1, leadId: 1, createdAt: -1 });
ConversationSchema.index({ phase: 1, clinicId: 1 });
ConversationSchema.index({ nextFollowUpAt: 1 }, { sparse: true });
ConversationSchema.index({ requiresHumanIntervention: 1, clinicId: 1 });
ConversationSchema.index({ isHighPriority: 1, clinicId: 1 });
ConversationSchema.index({ flaggedForReview: 1, clinicId: 1 });
ConversationSchema.index({ createdAt: -1 });
ConversationSchema.index(
  { ghlContactId: 1, clinicId: 1 },
  { unique: true, partialFilterExpression: { ghlContactId: { $type: 'string' } } },
);