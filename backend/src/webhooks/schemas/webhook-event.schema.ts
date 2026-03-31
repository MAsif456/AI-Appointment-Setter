import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { WEBHOOK_EVENT_TTL_SECONDS } from "../constants/webhook.constants";

export type WebhookEventDocument = WebhookEvent & Document;

export type WebhookDisposition =
  | "accepted"
  | "rejected_signature"
  | "rejected_replay"
  | "rejected_validation"
  | "rejected_rate_limit"
  | "duplicate";

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class WebhookEvent {
  @Prop({ required: true, unique: true, index: true })
  payloadHash: string;

  @Prop()
  eventType?: string;

  @Prop({ index: true })
  locationId?: string;

  @Prop({ required: true })
  disposition: WebhookDisposition;

  @Prop()
  ipAddress?: string;

  @Prop()
  signaturePrefix?: string;

  @Prop()
  rejectionReason?: string;

  @Prop()
  processingMs?: number;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

WebhookEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: WEBHOOK_EVENT_TTL_SECONDS },
);
WebhookEventSchema.index({ locationId: 1, createdAt: -1 });
WebhookEventSchema.index({ ipAddress: 1, createdAt: -1 });
WebhookEventSchema.index({ disposition: 1, createdAt: -1 });
