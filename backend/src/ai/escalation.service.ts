import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../database/schemas/conversation.schema";
import { Lead, LeadDocument } from "../database/schemas/lead.schema";
import { ClinicDocument } from "../database/schemas/clinic.schema";
import { GhlApiService } from "../ghl/ghl-api.service";
import {
  UrgencyAssessment,
  UrgencyLevel,
  EscalationResult,
} from "./urgency-detector.types";
import {
  PATIENT_EMERGENCY_RESPONSE,
  PATIENT_NO_SLOTS_URGENT,
  buildStaffAlert,
} from "./urgency-messages";

/**
 * Orchestrates emergency escalation, clinic staff notifications,
 * and GHL contact tag management for the urgency detection system (US18).
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  /**
   * Constructor.
   * @param {GhlApiService} ghlApiService - Service that interfaces with GHL's API.
   * @param {Model<ConversationDocument>} conversationModel - Mongoose model for conversations.
   * @param {Model<LeadDocument>} leadModel - Mongoose model for leads.
   */
  constructor(
    private readonly ghlApiService: GhlApiService,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
  ) {}

  /**
   * Runs the full emergency escalation workflow:
   * 1. Update conversation flags (isEmergency, requiresHumanIntervention, phase)
   * 2. Notify clinic staff via GHL
   * 3. Update lead tags
   * 4. Return pre-built emergency response for the patient
   */
  async escalateEmergency(
    conversation: ConversationDocument,
    lead: LeadDocument,
    clinic: ClinicDocument,
    assessment: UrgencyAssessment,
  ): Promise<EscalationResult> {
    const reason = assessment.emergencyKeywordsMatched.length
      ? `Emergency keywords detected: ${assessment.emergencyKeywordsMatched.join(", ")}`
      : "Emergency classified by urgency detector";

    // 1. Update conversation flags
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      isEmergency: true,
      requiresHumanIntervention: true,
      humanInterventionReason: reason,
      phase: "escalated",
      escalatedAt: new Date(),
      escalationReason: reason,
    });

    // 2. Notify clinic staff via GHL (fire-and-forget — don't block patient response)
    const contactId =
      lead.ghlContactId ?? conversation.ghlContactId ?? lead._id.toString();
    this.notifyClinicStaff(clinic, lead, reason, contactId).catch((err) =>
      this.logger.warn(`GHL emergency notification failed: ${err.message}`),
    );

    // 3. Update lead tags
    this.updateGhlTags(lead, "emergency").catch((err) =>
      this.logger.warn(`GHL tag update failed: ${err.message}`),
    );

    return { aiMessage: PATIENT_EMERGENCY_RESPONSE, escalationReason: reason };
  }

  /**
   * Handles the scenario where a lead is marked urgent but no slots are available.
   * Notifies clinic staff and returns a patient-facing message.
   */
  async handleNoSlotsForUrgent(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
  ): Promise<string> {
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      requiresHumanIntervention: true,
      humanInterventionReason: "Urgent patient — no slots available",
    });

    const contactId =
      lead.ghlContactId ?? conversation.ghlContactId ?? lead._id.toString();
    this.notifyClinicStaff(
      clinic,
      lead,
      "Urgent patient with no available slots",
      contactId,
    ).catch((err) =>
      this.logger.warn(`GHL no-slots notification failed: ${err.message}`),
    );

    return PATIENT_NO_SLOTS_URGENT;
  }

  /** Sends a formatted alert message to the clinic via GHL. */
  async notifyClinicStaff(
    clinic: ClinicDocument,
    lead: LeadDocument,
    reason: string,
    contactId: string,
  ): Promise<void> {
    await this.ghlApiService.sendMessageWithRetry({
      type: "SMS",
      contactId,
      message: buildStaffAlert(lead, reason),
    });
  }

  /** Adds the urgency-level tag to the lead's ghlTags array. */
  async updateGhlTags(lead: LeadDocument, level: UrgencyLevel): Promise<void> {
    const tag = level; // 'urgent', 'routine', or 'emergency'
    if (lead.ghlTags?.includes(tag)) return; // already tagged

    await this.leadModel.findByIdAndUpdate(lead._id, {
      $addToSet: { ghlTags: tag },
    });
  }
}
