import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type LeadDocument = Lead & Document;

@Schema({ _id: false })
export class ConsentRecord {
  @Prop({ required: true })
  optedIn: boolean;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop()
  optedOutAt?: Date;
}

@Schema({ timestamps: true })
export class Lead {
  @Prop({ type: Types.ObjectId, ref: "Clinic", required: true, index: true })
  clinicId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop({ trim: true, default: "unknown" })
  phone?: string;

  @Prop({ lowercase: true, trim: true })
  email?: string;

  @Prop({ trim: true, uppercase: true })
  postcode?: string;

  @Prop({
    type: String,
    enum: ["valid", "invalid", "not_checked"],
    default: "not_checked",
  })
  postcodeStatus: string;

  @Prop({ trim: true })
  issue?: string;

  @Prop({
    type: String,
    enum: ["urgent", "routine", "unknown"],
    default: "unknown",
  })
  urgency: string;

  @Prop({ type: String, enum: ["new", "returning"], default: "new" })
  patientType: string;

  @Prop()
  serviceType?: string;

  // Lead Source (for analytics)
  @Prop({
    type: String,
    enum: [
      "facebook",
      "instagram",
      "google_ads",
      "website",
      "referral",
      "whatsapp_direct",
      "other",
    ],
    required: true,
  })
  leadSource: string;

  @Prop({
    type: String,
    enum: ["sms", "whatsapp", "facebook", "instagram", "website", "email"],
    required: true,
  })
  preferredChannel: string;

  @Prop({ trim: true })
  ghlContactId?: string; // ID in GHL system

  @Prop({ type: [String], default: [] })
  ghlTags: string[]; // Tags applied in GHL

  @Prop({ type: ConsentRecord })
  consent?: ConsentRecord;

  @Prop({ default: 0 })
  totalAppointments: number;

  @Prop({ default: 0 })
  cancelledAppointments: number;

  @Prop({ default: 0 })
  noShows: number;

  @Prop()
  lastAppointmentAt?: Date;

  @Prop({ type: Map, of: String, default: {} })
  customFields: Map<string, string>; // for future needs

  // Timestamps: createdAt, updatedAt
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

// Indexes
LeadSchema.index(
  { clinicId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $ne: "unknown" } } },
);
LeadSchema.index({ clinicId: 1, email: 1 }, { unique: true, sparse: true });
LeadSchema.index({ ghlContactId: 1 });
LeadSchema.index({ clinicId: 1, createdAt: -1 });
LeadSchema.index({ clinicId: 1, leadSource: 1 });
LeadSchema.index({ postcode: 1 });
