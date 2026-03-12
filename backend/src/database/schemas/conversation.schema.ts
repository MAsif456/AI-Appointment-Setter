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
ConversationSchema.index({ ghlContactId: 1, clinicId: 1 }, { unique: true, sparse: true });