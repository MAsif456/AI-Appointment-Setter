import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true, index: true })
  clinicId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true })
  leadId: Types.ObjectId;

  @Prop({ type: String, enum: ['lead', 'ai', 'system'], required: true })
  sender: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: String, enum: ['sms', 'whatsapp', 'facebook', 'instagram', 'website'], required: true })
  channel: string;

  @Prop()
  ghlMessageId?: string; // ID from GHL system

  // Intent detection
  @Prop()
  detectedIntent?: string;

  @Prop({ type: Map, of: String, default: {} })
  extractedData: Map<string, string>; // { postcode: 'CF10 1AA', urgency: 'urgent' }

  // Message type flags
  @Prop({ default: false })
  isFallback: boolean; 

  @Prop({ default: false })
  isFollowUp: boolean;

  @Prop({ default: false })
  isReminder: boolean;

  // AI Processing Time (for "Avg Response Time" metric)
  @Prop()
  aiProcessingStartedAt?: Date;

  @Prop()
  aiProcessingCompletedAt?: Date;

  // Calculated field (virtual or pre-save hook)
  @Prop()
  aiProcessingTimeMs?: number; // Milliseconds

  @Prop()
  responseTimeSeconds?: number; //seconds

  // Delivery status
  @Prop({ type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' })
  status: string;

  @Prop()
  failureReason?: string;

  @Prop({ default: 0 })
  retryCount: number;

  // Timestamps: createdAt (message sent time), updatedAt
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ clinicId: 1, createdAt: -1 });
MessageSchema.index({ ghlMessageId: 1 });
MessageSchema.index({ clinicId: 1, sender: 1, createdAt: -1 }); // For analytics

// Pre-save hook to calculate processing time
MessageSchema.pre<MessageDocument>('save', function () {
  if (this.aiProcessingStartedAt && this.aiProcessingCompletedAt) {
    this.aiProcessingTimeMs =
      this.aiProcessingCompletedAt.getTime() -
      this.aiProcessingStartedAt.getTime();
  } //can add next() if using callback style
});