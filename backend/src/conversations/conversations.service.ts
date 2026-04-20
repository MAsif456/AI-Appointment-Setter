/** Manages live conversations: AI chat flow, slot offering, slot-selection, and auto-booking (US-15). */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../database/schemas/conversation.schema";
import { Message, MessageDocument } from "../database/schemas/message.schema";
import { Clinic, ClinicDocument } from "../database/schemas/clinic.schema";
import { Lead, LeadDocument } from "../database/schemas/lead.schema";
import { ChatService, ChatMessage } from "../ai/chat.service";
import { SlotProvider } from "../ai/slot-provider";
import { buildContextFromDb } from "./context-builder";
import { SlotSelectionResult } from "../ai/slot-selector";
import {
  AppointmentsService,
  BookingResult,
} from "../appointments/appointments.service";
import { UrgencyLevel } from "../ai/urgency-detector.types";
import { UrgencyPipeline } from "../ai/urgency-pipeline";
import {
  EscalationService,
  PATIENT_FAILED_UNDERSTANDING_RESPONSE,
} from "../ai/escalation.service";
import { ComprehensionClassifier } from "../ai/comprehension-classifier";
import { PATIENT_EMERGENCY_FOLLOWUP } from "../ai/urgency-messages";
import { AbuseHandlerService } from "./abuse-handler.service";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import {
  FALLBACK_AI_UNAVAILABLE,
  DETAILS_UNCHANGED_KEYWORDS,
  DETAILS_CHANGED_KEYWORDS,
  RESCHEDULE_KEYWORDS, matchesKeywords,
} from "../orchestrator/orchestrator.types";
import {
  CONSENT_GRANTED_KEYWORDS,
  CONSENT_DECLINED_KEYWORDS,
  CONSENT_ACKNOWLEDGED_RESPONSE,
  CONSENT_DECLINED_RESPONSE,
  CONSENT_DECLINED_FOLLOWUP,
  CONSENT_STATEMENT_TEXT,
} from "../gdpr/gdpr.types";
import { ConsentService } from "../gdpr/consent/consent.service";
import { GhlApiService } from '../ghl/ghl-api.service';
import { CancellationService } from "../cancellation/cancellation.service";
import { ConversationsPersistenceService } from "./conversations.persistence.service";
import { resolveSlotSelectionIntent } from "./slot-selection.resolver";
import { handleBooking } from "./conversations.booking.handler";
import { handleCancellationIntercept } from "./conversations.cancellation.handler";
import {
  handleDayOverview,
  buildAndSendReply,
} from "./conversations.reply.handler";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { handleDetailsChanged } from "../orchestrator/orchestrator.returning-patient-handlers";
import { PostcodeValidationService } from "../orchestrator/postcode-validation.service";
import { EncryptionService } from "../common/encryption/encryption.service";

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Clinic.name) private clinicModel: Model<ClinicDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private readonly chatService: ChatService,
    private readonly slotProvider: SlotProvider,
    private readonly appointmentsService: AppointmentsService,
    private readonly urgencyPipeline: UrgencyPipeline,
    private readonly escalationService: EscalationService,
    private readonly comprehensionClassifier: ComprehensionClassifier,
    private readonly abuseHandler: AbuseHandlerService,
    private readonly securityPipeline: SecurityPipelineService,
    private readonly ghlApiService: GhlApiService,
    private readonly cancellationService: CancellationService,
    private readonly persistence: ConversationsPersistenceService,
    private readonly patientHistoryService: PatientHistoryService,
    private readonly postcodeValidationService: PostcodeValidationService,
    private readonly encryptionService: EncryptionService,
    private readonly consentService: ConsentService,
  ) {}

  /** Retrieves a conversation with its messages and related clinic/lead data. */
  async getConversation(conversationId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException("Conversation not found");
    const [messages, clinic, lead] = await Promise.all([
      this.messageModel
        .find({ conversationId: conversation._id })
        .sort({ createdAt: 1 }),
      this.clinicModel.findById(conversation.clinicId),
      this.leadModel.findById(conversation.leadId),
    ]);
    return { conversation, messages, clinic, lead };
  }

  /** Lists all conversations with basic lead/clinic info. */
  async listConversations(clinicIds?: string[], includeAnonymised = false) {
    // If clinicIds provided and empty → staff with no assigned clinics → return empty array
    if (clinicIds !== undefined && clinicIds.length === 0) {
      return [];
    }
    const filter: Record<string, any> =
      clinicIds && clinicIds.length > 0
        ? { clinicId: { $in: clinicIds.map((id) => new Types.ObjectId(id)) } }
        : {};

    // Separate active conversations from anonymised (redacted) ones
    if (!includeAnonymised) {
      filter.isAnonymised = { $ne: true };
    } else {
      filter.isAnonymised = true;
    }

    return this.conversationModel
      .find(filter)
      .populate("clinicId", "name")
      .populate("leadId", "firstName lastName phone")
      .sort({ lastMessageAt: -1 });
  }

  /**
   * Generates the AI greeting for a conversation and saves it as the first message.
   * @returns The greeting message content, or null on failure.
   */
  async startConversation(conversationId: string): Promise<string | null> {
    const { conversation, clinic, lead } =
      await this.getConversation(conversationId);
    if (!clinic || !lead)
      throw new NotFoundException("Clinic or lead not found");

    if (lead.issue && lead.urgency === "unknown") {
      const { resolved } = this.urgencyPipeline.assessFormData(lead.issue);
      if (resolved !== "routine") {
        await this.leadModel.findByIdAndUpdate(lead._id, { urgency: resolved });
        (lead as any).urgency = resolved;
      }
    }

    const { leadInfo, clinicConfig } = buildContextFromDb(
      lead,
      clinic,
      conversation,
    );

    let greeting: string | null;
    if (conversation.isReturningPatient && conversation.returningPatientConfidence) {
      // Reconstruct from flags already stored on the conversation — avoids
      // a redundant PatientHistory DB query (flags were set during re-entry).
      const returningPatient = {
        firstName: lead.firstName ?? leadInfo.firstName ?? "",
        lastName: lead.lastName,
        validatedPostcode: conversation.context?.get("returningPatientPostcode"),
        previousConversationId: conversation.previousConversationId,
        lastBookedAt: new Date(),
        confidence: conversation.returningPatientConfidence as "high" | "medium" | "stale",
      };
      greeting = await this.chatService.startReturningPatientConversation(
        leadInfo,
        clinicConfig,
        returningPatient,
      );
    } else {
      greeting = await this.chatService.startConversation(
        leadInfo,
        clinicConfig,
      );
    }

    const finalGreeting = greeting ?? FALLBACK_AI_UNAVAILABLE;
    if (!greeting)
      this.logger.warn("Greeting generation failed — using fallback");

    // A new greeting signals a fresh chat session — clear any stale escalation
    // state so the AI can respond normally. (In production the previous
    // escalation will still be visible in the staff dashboard via notifications.)
    if (conversation.requiresHumanIntervention) {
      await this.conversationModel.findByIdAndUpdate(conversation._id, {
        $set: {
          requiresHumanIntervention: false,
          failedUnderstandingCount: 0,
        },
        $unset: { escalatedAt: '', escalationReason: '', humanInterventionReason: '' },
      });
    }

    await this.persistence.saveMessage(
      conversation,
      clinic,
      lead,
      "ai",
      finalGreeting,
    );
    await this.persistence.updateConversationMeta(
      conversation,
      "ai",
      "greeting",
    );
    return finalGreeting;
  }

  /**
   * Processes a lead's message, runs slot-selection detection, and generates
   * an AI reply. When the lead confirms a slot (SLOT_SELECTED), the appointment
   * is automatically booked via AppointmentsService. Both messages are persisted.
   * @returns Object with the AI reply, offered slots, selection result, and booking result.
   */
  async sendMessage(conversationId: string, userMessage: string) {
    const { conversation, messages, clinic, lead } =
      await this.getConversation(conversationId);
    if (!clinic || !lead)
      throw new NotFoundException("Clinic or lead not found");

    const { resolved: resolvedUrgency, assessment: urgencyAssessment } =
      await this.urgencyPipeline.assessMessage(
        userMessage,
        (lead.urgency as UrgencyLevel | "unknown") ?? "unknown",
        lead.issue,
      );

    await this.persistence.saveMessage(
      conversation,
      clinic,
      lead,
      "lead",
      userMessage,
      {
        level: urgencyAssessment.level,
        score: urgencyAssessment.score,
      },
    );

    // When the conversation is already escalated (phase OR requiresHumanIntervention —
    // the latter is set by handleNoSlotsForUrgent without changing phase),
    // do not run the AI pipeline. A human is handling it.
    if (conversation.phase === 'escalated' || conversation.requiresHumanIntervention) {
      const reply = "A team member has been notified and will be in touch shortly. Please hold on.";
      await this.persistence.saveMessage(conversation, clinic, lead, 'ai', reply);
      await this.persistence.updateConversationMeta(conversation, 'ai', undefined);
      return { reply, offeredSlots: [], slotSelection: null, bookingResult: null };
    }

    const abuseHandled = await this.abuseHandler.handle(
      conversation,
      clinic,
      lead,
      userMessage,
    );
    if (abuseHandled) {
      // US-20: the abuse handler flagged the lead as having accepted the
      // human hand-off — route it through the single escalation funnel
      // so GHL + notifications fire exactly like any other trigger.
      if (abuseHandled.escalationRequested) {
        await this.escalationService
          .escalate({
            conversation,
            lead,
            clinic,
            trigger: "abuse",
            reason: "Abuse hand-off: lead accepted human offer",
            patientMessage: abuseHandled.reply,
          })
          .catch((err) =>
            this.logger.warn(`Abuse escalation funnel failed: ${err.message}`),
          );
      }
      return abuseHandled;
    }

    // Security pipeline: sanitise input, detect injection, enforce boundaries
    const securityResult = await this.securityPipeline.processInbound(
      userMessage,
      conversationId,
      (conversation.clinicId as any).toString(),
      conversation.phase,
      (conversation.leadId as any).toString(),
    );
    if (!securityResult.allowed) {
      const fallback =
        securityResult.fallbackResponse ??
        "I'm here to help you book an appointment. How can I assist?";
      await this.persistence.saveMessage(
        conversation,
        clinic,
        lead,
        "ai",
        fallback,
      );
      await this.persistence.updateConversationMeta(
        conversation,
        "ai",
        undefined,
      );
      return {
        reply: fallback,
        offeredSlots: [],
        slotSelection: null,
        bookingResult: null,
      };
    }

    let clinicApiKey = '';
    if (clinic.ghlApiKey) {
      try { clinicApiKey = this.encryptionService.decrypt(clinic.ghlApiKey); } catch { /* no key */ }
    }
    const cancelResult = await handleCancellationIntercept(
      conversation,
      clinic,
      lead,
      userMessage,
      this.cancellationService,
      (sender, content, urgencyData) =>
        this.persistence.saveMessage(
          conversation,
          clinic,
          lead,
          sender,
          content,
          urgencyData,
        ),
      (lastFrom, phase) =>
        this.persistence.updateConversationMeta(conversation, lastFrom, phase),
      clinicApiKey,
      clinic.ghlLocationId ?? '',
    );
    if (cancelResult) return cancelResult;

    // Transition to rescheduling phase when the lead asks to reschedule from a booked state
    if (conversation.phase === 'booked' && RESCHEDULE_KEYWORDS.some(kw => userMessage.toLowerCase().includes(kw))) {
      await this.persistence.updateConversationMeta(conversation, 'lead', 'rescheduling');
      conversation.phase = 'rescheduling';
    }

    // Consent gate — UK GDPR Art. 9(2)(a) explicit consent before processing health data.
    // Ref: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/
    // Covers both LiveChat API and GHL webhook paths (orchestrator delegates here).
    if (conversation.phase === 'consenting' || conversation.phase === 'consent_declined') {
      const lower = userMessage.toLowerCase().trim();
      if (matchesKeywords(lower, CONSENT_GRANTED_KEYWORDS)) {
        await this.consentService.recordConsent(
          (conversation.leadId as any).toString(),
          (conversation.clinicId as any).toString(),
          'granted',
          conversation.channel,
          conversationId,
        );
        await this.persistence.updateConversationMeta(conversation, 'ai', 'qualifying');
        const reply = CONSENT_ACKNOWLEDGED_RESPONSE;
        await this.persistence.saveMessage(conversation, clinic, lead, 'ai', reply);
        return { reply, offeredSlots: [], slotSelection: null, bookingResult: null };
      }
      if (matchesKeywords(lower, CONSENT_DECLINED_KEYWORDS)) {
        await this.consentService.recordConsent(
          (conversation.leadId as any).toString(),
          (conversation.clinicId as any).toString(),
          'declined',
          conversation.channel,
          conversationId,
        );
        await this.persistence.updateConversationMeta(conversation, 'ai', 'consent_declined');
        const reply = CONSENT_DECLINED_RESPONSE;
        await this.persistence.saveMessage(conversation, clinic, lead, 'ai', reply);
        return { reply, offeredSlots: [], slotSelection: null, bookingResult: null };
      }
      // Unrecognised message in consent_declined — static follow-up
      if (conversation.phase === 'consent_declined') {
        const reply = CONSENT_DECLINED_FOLLOWUP;
        await this.persistence.saveMessage(conversation, clinic, lead, 'ai', reply);
        return { reply, offeredSlots: [], slotSelection: null, bookingResult: null };
      }
      // Unrecognised message in consenting — re-prompt for consent
      const reply = CONSENT_STATEMENT_TEXT;
      await this.persistence.saveMessage(conversation, clinic, lead, 'ai', reply);
      return { reply, offeredSlots: [], slotSelection: null, bookingResult: null };
    }

    // Returning patient detail confirmation — LiveChat API path.
    // NOTE: The GHL webhook path handles the same signals in orchestrator.inbound-message.ts.
    // See that file for an explanation of why both paths exist.
    if (conversation.isReturningPatient && conversation.phase === "greeting") {
      const lower = userMessage.toLowerCase().trim();
      if (matchesKeywords(lower, DETAILS_UNCHANGED_KEYWORDS)) {
        // Copy stored postcode into active context so booking flow can use it
        const storedPostcode = conversation.context?.get(
          "returningPatientPostcode",
        );
        if (storedPostcode) {
          await this.conversationModel.findByIdAndUpdate(conversation._id, {
            $set: { "context.validatedPostcode": storedPostcode },
          });
          conversation.context?.set("validatedPostcode", storedPostcode);
        }
        await this.persistence.updateConversationMeta(
          conversation,
          "ai",
          "booking",
        );
        // Fall through to normal AI flow — no intermediate acknowledgement message
      }
      if (matchesKeywords(lower, DETAILS_CHANGED_KEYWORDS)) {
        await this.persistence.updateConversationMeta(
          conversation,
          "ai",
          "qualifying",
        );
        const reply = handleDetailsChanged();
        await this.persistence.saveMessage(
          conversation,
          clinic,
          lead,
          "ai",
          reply,
        );
        return {
          reply,
          offeredSlots: [],
          slotSelection: null,
          bookingResult: null,
        };
      }
    }

    // Save validated postcode to context whenever a valid postcode is detected in any message.
    // This ensures PatientHistory captures the postcode for both new and returning patients.
    if (["greeting", "qualifying"].includes(conversation.phase)) {
      const serviceAreas =
        clinic.serviceAreas?.map((sa: any) => sa.postcodePrefix) ?? [];
      const postcodeResult = this.postcodeValidationService.validate(
        userMessage,
        serviceAreas,
      );
      if (postcodeResult.status === "valid" && postcodeResult.postcode) {
        await this.conversationModel.findByIdAndUpdate(conversation._id, {
          $set: { "context.validatedPostcode": postcodeResult.postcode },
        });
        conversation.context?.set("validatedPostcode", postcodeResult.postcode);
      }
    }

    const history: ChatMessage[] = [
      ...messages.map((m) => ({
        role: m.sender === "ai" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];
    const { leadInfo, clinicConfig } = buildContextFromDb(
      lead,
      clinic,
      conversation,
    );

    if (resolvedUrgency !== lead.urgency) {
      await this.leadModel.findByIdAndUpdate(lead._id, {
        urgency: resolvedUrgency,
      });
      this.escalationService
        .updateGhlTags(lead, resolvedUrgency)
        .catch((err) =>
          this.logger.warn(`GHL tag update failed: ${err.message}`),
        );
    }

    if (resolvedUrgency === "emergency") {
      // Already escalated — send a softer follow-up to avoid repeating the full escalation message
      if (conversation.phase === "escalated") {
        await this.persistence.saveMessage(
          conversation,
          clinic,
          lead,
          "ai",
          PATIENT_EMERGENCY_FOLLOWUP,
        );
        await this.persistence.updateConversationMeta(
          conversation,
          "ai",
          undefined,
        );
        return {
          reply: PATIENT_EMERGENCY_FOLLOWUP,
          offeredSlots: [],
          slotSelection: null,
          bookingResult: null,
        };
      }
      const escalation = await this.escalationService.escalateEmergency(
        conversation,
        lead,
        clinic,
        urgencyAssessment,
      );
      await this.persistence.saveMessage(
        conversation,
        clinic,
        lead,
        "ai",
        escalation.aiMessage,
      );
      await this.persistence.updateConversationMeta(
        conversation,
        "ai",
        "escalated",
      );
      return {
        reply: escalation.aiMessage,
        offeredSlots: [],
        slotSelection: null,
        bookingResult: null,
      };
    }

    const urgency: "urgent" | "routine" | "flexible" =
      resolvedUrgency === "urgent"
        ? "urgent"
        : resolvedUrgency === "routine"
          ? "routine"
          : "flexible";

    const selectionResult = await resolveSlotSelectionIntent(
      conversation,
      userMessage,
      this.conversationModel,
      this.logger,
    );

    let bookingResult: BookingResult | null = null;
    if (
      selectionResult?.intent === "SLOT_SELECTED" &&
      selectionResult.selectedSlot
    ) {
      // If rescheduling, cancel the existing GHL appointment before booking the new one
      if (conversation.phase === 'rescheduling') {
        const oldGhlApptId = conversation.context?.get('ghlAppointmentId');
        if (oldGhlApptId) {
          const cancelled = await this.ghlApiService.cancelAppointment(clinicApiKey, oldGhlApptId);
          if (cancelled === null) {
            this.logger.error(`Failed to cancel old appointment ${oldGhlApptId} during reschedule`);
          }
        }
      }
      bookingResult = await handleBooking(
        conversation,
        clinic,
        lead,
        selectionResult,
        this.appointmentsService,
        this.logger,
      );
    }

    const replyDeps = {
      slotProvider: this.slotProvider,
      chatService: this.chatService,
      escalationService: this.escalationService,
      persistence: this.persistence,
      conversationModel: this.conversationModel,
    };

    if (selectionResult?.intent === "DAY_OVERVIEW") {
      return handleDayOverview(
        conversation,
        clinic,
        lead,
        history,
        userMessage,
        selectionResult,
        clinicConfig,
        leadInfo,
        replyDeps,
      );
    }

    const result = await buildAndSendReply(
      conversation,
      clinic,
      lead,
      history,
      userMessage,
      selectionResult,
      urgency,
      bookingResult,
      clinicConfig,
      leadInfo,
      replyDeps,
    );

    return this.handleComprehensionOutcome(
      conversation,
      clinic,
      lead,
      userMessage,
      resolvedUrgency,
      result,
    );
  }

  /**
   * US-20: run the comprehension classifier on the AI's draft reply and
   * either escalate (3 consecutive failures) or reset the counter.
   *
   * Skipped when the urgency pipeline flagged the message as urgent or
   * emergency — the AI's standard booking-flow reply (e.g. asking for
   * a postcode) is not a comprehension failure in a medical context.
   * Also skipped on FALLBACK_AI_UNAVAILABLE — a Groq outage is not
   * a comprehension failure either.
   */
  private async handleComprehensionOutcome(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    userMessage: string,
    resolvedUrgency: string,
    result: any,
  ) {
    if (!result?.reply) return result;
    if (result.reply === FALLBACK_AI_UNAVAILABLE) return result;
    // Medical urgency — the AI's booking-flow reply is intentional,
    // not a sign that it failed to understand the lead.
    if (resolvedUrgency === "urgent" || resolvedUrgency === "emergency") {
      return result;
    }

    const outcome = await this.comprehensionClassifier.classify(
      userMessage,
      result.reply,
    );

    if (outcome === "understood") {
      if ((conversation.failedUnderstandingCount ?? 0) > 0) {
        await this.conversationModel.findByIdAndUpdate(conversation._id, {
          failedUnderstandingCount: 0,
        });
      }
      return result;
    }

    // Unclear — increment the counter atomically and read the new value.
    const updated = await this.conversationModel.findByIdAndUpdate(
      conversation._id,
      { $inc: { failedUnderstandingCount: 1 } },
      { returnDocument: 'after' },
    );
    const count = updated?.failedUnderstandingCount ?? 0;
    this.logger.log(
      `Comprehension failure #${count} on conversation ${conversation._id}`,
    );

    if (count < 3) return result;

    // Third strike — funnel through the single escalation entry point.
    const escalation = await this.escalationService.escalate({
      conversation: updated ?? conversation,
      lead,
      clinic,
      trigger: "failed_understanding",
      reason: "3 consecutive AI comprehension failures",
      patientMessage: PATIENT_FAILED_UNDERSTANDING_RESPONSE,
    });

    // Replace the ambiguous AI reply with the hand-off message and
    // persist it so the transcript shows the escalation cleanly.
    await this.persistence.saveMessage(
      conversation,
      clinic,
      lead,
      "ai",
      escalation.aiMessage,
    );
    await this.persistence.updateConversationMeta(
      conversation,
      "ai",
      "escalated",
    );

    return {
      ...result,
      reply: escalation.aiMessage,
    };
  }

  /** Resets a conversation by deleting all messages and resetting phase. */
  async resetConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException("Conversation not found");
    await this.messageModel.deleteMany({ conversationId: conversation._id });

    // Preserve returning patient postcode across reset so the AI doesn't re-ask for it
    const returningPostcode = conversation.context?.get(
      "returningPatientPostcode",
    );

    // NOTE: isReturningPatient, previousConversationId, and returningPatientConfidence
    // are intentionally NOT reset here. A conversation reset (e.g. re-booking after a
    // failed flow) should still recognise the patient as returning so the greeting
    // correctly offers to reuse their details on file. These flags are set once at
    // conversation start by PatientHistoryService.findReturningPatient.
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      $set: {
        phase: "greeting",
        messageCount: 0,
        offeredSlots: [],
        slotHistory: [],
        directedHostilityCount: 0,
        abuseOfferPending: false,
        lastMessageAt: null,
        lastMessageFrom: null,
        awaitingDaySelection: false,
        lastRequestedDay: null,
        lastRequestedDateStart: null,
        lastRequestedDateEnd: null,
        appointmentId: null,
        ...(returningPostcode
          ? {
              "context.returningPatientPostcode": returningPostcode,
              "context.validatedPostcode": returningPostcode,
            }
          : {}),
      },
    });
    await this.leadModel.findByIdAndUpdate(conversation.leadId, {
      urgency: "unknown",
    });
  }
}
