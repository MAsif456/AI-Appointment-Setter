import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  EscalationNotification,
  EscalationNotificationDocument,
} from "../database/schemas/escalation-notification.schema";
import { Message, MessageDocument } from "../database/schemas/message.schema";
import { Lead, LeadDocument } from "../database/schemas/lead.schema";

/**
 * REST-facing operations on the `EscalationNotification` collection.
 *
 * The SSE bell is the fast path for in-session staff; this service
 * powers the reload-proof queue and the acknowledge / resolve
 * actions from the notification panel.
 */
@Injectable()
export class EscalationsService {
  constructor(
    @InjectModel(EscalationNotification.name)
    private readonly model: Model<EscalationNotificationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  /** List every unresolved escalation for the staff member's clinics. */
  async listUnresolved(userId: string, assignedClinics: string[]) {
    if (assignedClinics.length === 0) return [];
    const clinicIds = assignedClinics.map((id) => new Types.ObjectId(id));
    const docs = await this.model
      .find({ clinicId: { $in: clinicIds }, resolvedAt: null })
      .sort({ createdAt: -1 });

    return docs.map((doc) => this.serialise(doc, userId));
  }

  /**
   * Fetch a single escalation with its conversation transcript so
   * the read-only view has everything on one payload.
   */
  async getWithTranscript(
    id: string,
    userId: string,
    assignedClinics: string[],
  ) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException("Escalation not found");
    this.assertAccess(doc, assignedClinics);

    const [messages, lead] = await Promise.all([
      this.messageModel
        .find({ conversationId: doc.conversationId })
        .sort({ createdAt: 1 }),
      this.leadModel.findById(doc.leadId),
    ]);

    return {
      ...this.serialise(doc, userId),
      messages: messages.map((m) => ({
        id: (m._id as any).toString(),
        sender: m.sender,
        content: m.content,
        timestamp: (m as any).createdAt,
      })),
      lead: lead
        ? {
            id: (lead._id as any).toString(),
            firstName: lead.firstName,
            lastName: lead.lastName,
            phone: lead.phone,
            email: lead.email,
          }
        : null,
    };
  }

  /** Per-user acknowledge (dismiss from this staff member's bell). */
  async acknowledge(
    id: string,
    userId: string,
    assignedClinics: string[],
  ): Promise<void> {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException("Escalation not found");
    this.assertAccess(doc, assignedClinics);

    // Skip if already acknowledged — keeps the array clean.
    const already = doc.acknowledgements.some(
      (a) => a.userId.toString() === userId,
    );
    if (already) return;

    await this.model.findByIdAndUpdate(id, {
      $push: {
        acknowledgements: {
          userId: new Types.ObjectId(userId),
          acknowledgedAt: new Date(),
        },
      },
    });
  }

  /** Clinic-wide resolve — every staff member's card drops off. */
  async resolve(id: string, assignedClinics: string[]): Promise<void> {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException("Escalation not found");
    this.assertAccess(doc, assignedClinics);

    await this.model.findByIdAndUpdate(id, { resolvedAt: new Date() });
  }

  /** Throws if the requesting user's clinics do not cover this doc. */
  private assertAccess(
    doc: EscalationNotificationDocument,
    assignedClinics: string[],
  ): void {
    const docClinicId = doc.clinicId.toString();
    if (!assignedClinics.includes(docClinicId)) {
      throw new ForbiddenException(
        "You do not have access to this escalation",
      );
    }
  }

  /** Maps a persisted doc into the frontend-facing shape. */
  private serialise(
    doc: EscalationNotificationDocument,
    userId: string,
  ) {
    return {
      id: (doc._id as any).toString(),
      conversationId: doc.conversationId.toString(),
      leadId: doc.leadId.toString(),
      leadName: doc.leadName,
      leadPhone: doc.leadPhone,
      clinicId: doc.clinicId.toString(),
      clinicName: doc.clinicName,
      trigger: doc.trigger,
      reason: doc.reason,
      createdAt: (doc as any).createdAt,
      acknowledgedByMe: doc.acknowledgements.some(
        (a) => a.userId.toString() === userId,
      ),
      resolvedAt: doc.resolvedAt,
    };
  }
}
