import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EscalationNotificationDocument = EscalationNotification & Document;

/**
 * Per-user acknowledgement sub-document.
 * Each staff member that dismisses an escalation from their bell gets
 * their own entry; the clinic-wide resolution lives on the parent doc.
 */
@Schema({ _id: false })
export class Acknowledgement {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  acknowledgedAt: Date;
}

/**
 * Audit + queue record for every escalation raised on the platform.
 *
 * We store these separately from `Conversation` so that:
 *  - Multiple staff per clinic each track their own ack state, and
 *  - The queue survives conversation-level state changes (closure,
 *    reset, archival) and is easy to query independently.
 */
@Schema({ timestamps: true })
export class EscalationNotification {
  @Prop({ type: Types.ObjectId, ref: "Conversation", required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Lead", required: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Clinic", required: true, index: true })
  clinicId: Types.ObjectId;

  // One of: 'failed_understanding' | 'emergency' | 'abuse'.
  // Stored as a plain string to avoid a migration if a new trigger
  // is added later — the frontend enum is the canonical contract.
  @Prop({ required: true })
  trigger: string;

  @Prop({ required: true })
  reason: string;

  // Denormalised for fast read: the staff panel needs these on list
  // render and a join-per-row is wasteful.
  @Prop({ required: true })
  leadName: string;

  @Prop({ default: "" })
  leadPhone: string;

  @Prop({ required: true })
  clinicName: string;

  @Prop({ type: [Acknowledgement], default: [] })
  acknowledgements: Acknowledgement[];

  // When any staff member marks this resolved the value is set and
  // the record drops off every staff member's queue.
  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;

  // timestamps: createdAt, updatedAt
}

export const EscalationNotificationSchema = SchemaFactory.createForClass(
  EscalationNotification,
);

// Composite index for the two hot queries — "list unresolved for a
// clinic" and "find by conversation for idempotency guard".
EscalationNotificationSchema.index({
  clinicId: 1,
  resolvedAt: 1,
  createdAt: -1,
});
EscalationNotificationSchema.index({ conversationId: 1 });
