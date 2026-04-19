import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type NotificationDocument = Notification & Document;
export type NotificationType =
  | "email_notification"
  | "stalled_conversation"
  | "appointment_reminder"
  | "escalated_conversation"
  | "booking_cancelled"
  | "new_user_joined"
  | "gdpr_data_deletion";
export type RelatedEntityType = "conversation" | "appointment" | "user";

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: [
      "email_notification",
      "stalled_conversation",
      "appointment_reminder",
      "escalated_conversation",
      "booking_cancelled",
      "new_user_joined",
      "gdpr_data_deletion",
    ],
    required: true,
  })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  relatedEntityId?: string;

  @Prop({ type: String, enum: ["conversation", "appointment", "user"] })
  relatedEntityType?: RelatedEntityType;

  @Prop()
  dismissedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });