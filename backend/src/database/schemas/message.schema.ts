import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { fieldEncryptionPlugin } from "../../gdpr/encryption/field-encryption.plugin";

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({
    type: Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true,
  })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Clinic", required: true, index: true })
  clinicId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Lead", required: true })
  leadId: Types.ObjectId;

  @Prop({ type: String, enum: ["lead", "ai", "system"], required: true })
  sender: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    type: String,
    enum: ["sms", "whatsapp", "facebook", "instagram", "website", "email"],
    required: true,
  })
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

  // Abuse detection
  @Prop({ default: false })
  isAbusive: boolean;

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
  @Prop({
    type: String,
    enum: ["sent", "delivered", "read", "failed"],
    default: "sent",
  })
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

// Apply field-level encryption to message content (UK GDPR Art. 5(1)(f))
// Ref: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/the-principles/integrity-and-confidentiality-security/
if (process.env.FIELD_ENCRYPTION_KEY) {
  MessageSchema.plugin(fieldEncryptionPlugin, {
    fields: ['content'],
    encryptionKey: process.env.FIELD_ENCRYPTION_KEY,
    modelName: 'Message',
  });
}

// Pre-save hook to calculate processing time
MessageSchema.pre<MessageDocument>("save", function () {
  if (this.aiProcessingStartedAt && this.aiProcessingCompletedAt) {
    this.aiProcessingTimeMs =
      this.aiProcessingCompletedAt.getTime() -
      this.aiProcessingStartedAt.getTime();
  } //can add next() if using callback style
});
