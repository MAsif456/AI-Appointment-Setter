import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../database/schemas/conversation.schema";
import { Lead, LeadDocument } from "../database/schemas/lead.schema";
import { ClinicDocument } from "../database/schemas/clinic.schema";
import {
  UrgencyAssessment,
  UrgencyLevel,
  EscalationResult,
} from "./urgency-detector.types";
import {
  PATIENT_EMERGENCY_RESPONSE,
  PATIENT_NO_SLOTS_URGENT,
} from "./urgency-messages";
import { EscalationGhlService } from "./escalation-ghl.service";
import { EscalationNotifierService } from "./escalation-notifier.service";
import { EscalationContext, EscalationResultV2 } from "./escalation.types";

/**
 * Patient-facing copy for the failed-understanding trigger. This is
 * specified verbatim by the acceptance criteria in the user story.
 */
export const PATIENT_FAILED_UNDERSTANDING_RESPONSE =
  "I'm having trouble understanding. Let me get a team member to help you — they'll be in touch shortly.";

/**
 * Orchestrates every escalation path on the platform.
 *
 * Exposes a single `escalate(ctx)` entry point that every trigger
 * funnels through: failed-understanding, abuse hand-off, emergency,
 * and urgent-no-slots. The existing public methods (`escalateEmergency`,
 * `handleNoSlotsForUrgent`, `updateGhlTags`) are kept as thin adapters
 * so the urgency pipeline and other callers do not need to change.
 *
 * This file MUST stay under 200 lines — GHL calls live in
 * `escalation-ghl.service.ts` and persistence in
 * `escalation-notifier.service.ts`.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private readonly ghl: EscalationGhlService,
    private readonly notifier: EscalationNotifierService,
  ) {}

  /**
   * Single funnel for every escalation trigger. Performs:
   *  1. Idempotent conversation update (phase → escalated, flags set)
   *  2. GHL tag + custom field + staff SMS via `EscalationGhlService`
   *  3. Persisted notification + SSE bus publish via notifier
   *
   * The Mongo `findOneAndUpdate` guard in step 1 ensures that two
   * concurrent triggers on the same conversation produce exactly
   * one notification — the second call sees `requiresHumanIntervention`
   * already set and returns early without re-firing downstream work.
   */
  async escalate(ctx: EscalationContext): Promise<EscalationResultV2> {
    const updated = await this.conversationModel.findOneAndUpdate(
      { _id: ctx.conversation._id, requiresHumanIntervention: { $ne: true } },
      {
        $set: {
          requiresHumanIntervention: true,
          humanInterventionReason: ctx.reason,
          phase: "escalated",
          escalatedAt: new Date(),
          escalationReason: ctx.reason,
          ...(ctx.trigger === "emergency" ? { isEmergency: true } : {}),
        },
      },
      { new: true },
    );

    const aiMessage = ctx.patientMessage ?? this.defaultMessageFor(ctx.trigger);

    if (!updated) {
      // Already escalated — do not re-fire GHL or notifier. Returning
      // the patient message keeps the caller's flow consistent.
      this.logger.log(
        `Escalation skipped (already escalated): ${ctx.conversation._id}`,
      );
      return {
        aiMessage,
        escalationReason: ctx.reason,
        notificationId: null,
      };
    }

    // Downstream work runs in the background — we must not block the
    // patient's reply on GHL latency. Errors are contained inside
    // each helper and logged there.
    this.ghl
      .applyEscalationToGhl(ctx.lead, ctx.conversation, ctx.clinic, ctx.reason)
      .catch((err) =>
        this.logger.warn(`GHL escalation step failed: ${err.message}`),
      );
    const notificationId = await this.notifier.recordAndPublish(ctx);

    return { aiMessage, escalationReason: ctx.reason, notificationId };
  }

  /** Maps a trigger to the default patient-facing message. */
  private defaultMessageFor(trigger: EscalationContext["trigger"]): string {
    switch (trigger) {
      case "failed_understanding":
        return PATIENT_FAILED_UNDERSTANDING_RESPONSE;
      case "emergency":
        return PATIENT_EMERGENCY_RESPONSE;
      case "abuse":
        // The abuse handler has its own canned confirmation which is
        // passed in via `patientMessage`; this default is only used
        // as a safety net.
        return "A team member will be in touch shortly.";
    }
  }

  // ---- Back-compat adapters over the funnel ----

  /**
   * Legacy entry point kept for the urgency pipeline. Delegates to
   * `escalate()` with trigger=emergency so every path in the system
   * converges on the same bookkeeping.
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

    const result = await this.escalate({
      conversation,
      lead,
      clinic,
      trigger: "emergency",
      reason,
      patientMessage: PATIENT_EMERGENCY_RESPONSE,
    });
    return { aiMessage: result.aiMessage, escalationReason: result.escalationReason };
  }

  /**
   * Legacy urgent-no-slots handler. Flags the conversation and
   * notifies staff without changing phase to `escalated` — this
   * scenario is about routing, not breakdown, so the AI can continue.
   */
  async handleNoSlotsForUrgent(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
  ): Promise<string> {
    const reason = "Urgent patient — no slots available";
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      requiresHumanIntervention: true,
      humanInterventionReason: reason,
    });
    // Fire only the GHL + notifier side (no phase change) so staff
    // still see the notification and the lead still gets a routing SMS.
    this.ghl
      .applyEscalationToGhl(lead, conversation, clinic, reason)
      .catch((err) =>
        this.logger.warn(`GHL no-slots step failed: ${err.message}`),
      );
    await this.notifier.recordAndPublish({
      conversation,
      lead,
      clinic,
      trigger: "emergency",
      reason,
    });
    return PATIENT_NO_SLOTS_URGENT;
  }

  /** Adds the urgency-level tag to the lead's ghlTags array. */
  async updateGhlTags(lead: LeadDocument, level: UrgencyLevel): Promise<void> {
    if (lead.ghlTags?.includes(level)) return;
    await this.leadModel.findByIdAndUpdate(lead._id, {
      $addToSet: { ghlTags: level },
    });
  }
}
