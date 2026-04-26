/**
 * Standalone handler for the ContactCreate (new lead) webhook flow.
 *
 * Extracted from OrchestratorService to keep each file under the 200-line limit.
 * Receives its dependencies as a plain object so it can be called from the
 * injectable service without coupling to NestJS DI.
 */
import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { GreetingService } from "../ai/greeting.service";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { ConversationsService } from "../ghl/conversations.service";
import { MessagesService } from "../ghl/messages.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { GhlContactCreatePayload } from "../webhooks/dto/ghl-webhook.dto";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { ConsentService } from "../gdpr/consent/consent.service";
import { CONSENT_STATEMENT_TEXT } from "../gdpr/gdpr.types";
import { FALLBACK_AI_UNAVAILABLE } from "./orchestrator.types";
import { channelToMessageType } from "./orchestrator.prompts";
import { getChannelAdapter } from "../ghl/channel-adapter";
import { InboxNotificationService } from "../notifications/inbox-notification.service";

/** Dependencies injected by OrchestratorService. */
export interface NewLeadDeps {
  greetingService: GreetingService;
  conversationsService: ConversationsService;
  messagesService: MessagesService;
  ghlApiService: GhlApiService;
  patientHistoryService: PatientHistoryService;
  securityPipeline: SecurityPipelineService;
  consentService: ConsentService;
  inboxNotificationService: InboxNotificationService;
  logger: Logger;
  correlationId?: string;
}

/**
 * Handles a new lead from a ContactCreate GHL webhook event.
 *
 * Flow:
 *   1. Validate contactId is present.
 *   2. Create a GHL conversation via the GHL API (gracefully skips if it fails).
 *   3. Create the conversation context document in MongoDB.
 *   4. Look up PatientHistory to check if this is a returning patient.
 *   5a. Returning patient: update conversation flags, store historical postcode,
 *       log analytics event, generate returning-patient greeting, stay in 'greeting'.
 *   5b. New patient: generate standard greeting, advance phase to 'qualifying'.
 *   6. Send the greeting to the lead via the GHL API (with retry).
 *   7. Persist the AI greeting as a message in MongoDB.
 */
/**
 * Detects the appropriate messaging channel for a new lead.
 * Email is checked first: if the contact provided an email address they expect
 * an email response. Phone-only contacts receive SMS.
 */
function detectLeadChannel(payload: GhlContactCreatePayload): string {
  if (payload.email) return "email";
  if (payload.phone) return "sms";
  return "sms";
}

export async function handleNewLeadFlow(
  webhookData: GhlContactCreatePayload,
  clinicConfig: ClinicConfig,
  deps: NewLeadDeps,
): Promise<void> {
  const {
    greetingService,
    conversationsService,
    messagesService,
    ghlApiService,
    patientHistoryService,
    securityPipeline,
    consentService,
    inboxNotificationService,
    logger,
    correlationId,
  } = deps;
  const cid = correlationId ? `[${correlationId}] ` : "";
  const { first_name, last_name, phone, email, issue } = webhookData;
  const contactId = webhookData["id"] as string | undefined;

  if (!contactId) {
    logger.warn(
      `ContactCreate payload missing contactId — clinicId: ${clinicConfig.clinicId}. Skipping.`,
    );
    return;
  }

  const clinicObjectId = new Types.ObjectId(clinicConfig.clinicId);

  // Create a GHL conversation so we have a conversationId to send messages against
  let ghlConversationId = "";
  try {
    const ghlConversation = await ghlApiService.createConversation(
      clinicConfig.ghlApiKey ?? '',
      contactId,
      clinicConfig.ghlLocationId,
    );
    ghlConversationId =
      ghlConversation?.id ?? ghlConversation?.conversation?.id ?? "";
  } catch (error) {
    logger.warn(
      `Failed to create GHL conversation — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}. Continuing with empty conversationId. Error: ${(error as Error).message}`,
    );
  }

  const channel = detectLeadChannel(webhookData);

  // Create conversation context in MongoDB
  let conversation;
  try {
    conversation = await conversationsService.createForNewLead(
      clinicObjectId,
      contactId,
      ghlConversationId,
      channel,
      {
        firstName: first_name ?? "Unknown",
        phone: phone ?? "unknown",
        email,
        issue,
        leadSource: "other",
      },
    );
  } catch (error) {
    logger.error(
      `Failed to create conversation context — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
      (error as Error).stack,
    );
    return;
  }

  // Notify clinic staff of the new enquiry (fire-and-forget, non-fatal)
  const leadName = `${first_name ?? ''} ${last_name ?? ''}`.trim() || 'Unknown';
  inboxNotificationService.createForClinicStaff(
    clinicConfig.clinicId,
    'new_lead',
    'New lead',
    `${leadName} has started a new conversation`,
    conversation._id.toString(),
    'conversation',
  ).catch((err: Error) => logger.warn(`Failed to create inbox notification: ${err.message}`));

  // Check if this lead has booked with this clinic before
  const expiryDays = clinicConfig.patientDataExpiryDays ?? 365;
  const returningPatient = await patientHistoryService.findReturningPatient(
    phone,
    email,
    clinicConfig.clinicId,
    expiryDays,
  );

  if (returningPatient) {
    // Update conversation with returning patient flags
    await conversationsService.updateReturningPatientFlags(
      conversation._id as Types.ObjectId,
      {
        isReturningPatient: true,
        previousConversationId: returningPatient.previousConversationId,
        returningPatientConfidence: returningPatient.confidence,
      },
    );

    // Store the historical postcode so DETAILS_UNCHANGED can skip qualification
    if (returningPatient.validatedPostcode) {
      await conversationsService.setContext(
        conversation._id as Types.ObjectId,
        "returningPatientPostcode",
        returningPatient.validatedPostcode,
      );
    }

    // Structured analytics log for returning patient detection
    logger.log(
      `RETURNING_PATIENT_DETECTED clinicId=${clinicConfig.clinicId} contactId=${contactId} confidence=${returningPatient.confidence} previousConversationId=${returningPatient.previousConversationId?.toString() ?? "none"}`,
    );
  }

  const leadInfo = {
    firstName: first_name ?? "there",
    lastName: last_name,
    phone,
    email,
    issue,
    contactId,
  };

  // Generate greeting — returning patients get a personalised welcome-back message
  let greeting: string | null;
  if (returningPatient) {
    greeting = await greetingService.generateReturningPatientGreeting(
      leadInfo,
      clinicConfig,
      returningPatient,
    );
  } else {
    greeting = await greetingService.generateGreeting(leadInfo, clinicConfig);
  }

  if (!greeting) {
    logger.warn(
      `${cid}AI greeting generation failed — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}. Using fallback message.`,
    );
    greeting = FALLBACK_AI_UNAVAILABLE;
    await conversationsService.flagForHumanIntervention(
      conversation._id as Types.ObjectId,
      "AI service failure",
    );
  }

  // Ref: OWASP Top 10 for LLM Applications 2025, LLM05 — Improper Output Handling
  //   https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/
  // AI outputs must be treated as untrusted; validate before delivery.
  const outputCheck = securityPipeline.validateOutput(greeting, "greeting");
  if (!outputCheck.safe) {
    logger.warn(
      `${cid}Greeting output validation failed — flags: ${outputCheck.flags.join(",")} — contactId: ${contactId}`,
    );
    greeting = outputCheck.fallbackResponse ?? FALLBACK_AI_UNAVAILABLE;
  }

  // Determine target phase BEFORE sending so the consent statement
  // is included in the greeting message delivered to the patient.
  // Returning patients with prior consent stay in 'greeting' so the next reply
  // can be detected as DETAILS_UNCHANGED / DETAILS_CHANGED.
  // Returning patients without consent (e.g. after erasure) route to 'consenting'.
  // New patients always route to 'consenting' for UK GDPR Art. 9(2)(a) explicit consent.
  let targetPhase: string;
  if (returningPatient) {
    const hasConsent = await consentService.hasActiveConsent(
      (conversation.leadId as Types.ObjectId).toString(),
      clinicConfig.clinicId,
    );
    targetPhase = hasConsent ? 'greeting' : 'consenting';
  } else {
    targetPhase = 'consenting';
  }

  // Append consent statement so the patient sees it in the first message.
  // UK GDPR Art. 9(2)(a) requires explicit consent before processing health data.
  if (targetPhase === 'consenting') {
    greeting = `${greeting}\n\n${CONSENT_STATEMENT_TEXT}`;
  }

  // Send via GHL (3x retry with jitter handled by GhlApiService)
  let ghlMessageId: string | undefined;
  try {
    const adapter = getChannelAdapter(channel);
    const formatted = adapter.formatOutbound(greeting, clinicConfig.name, true);
    const sendResult = await ghlApiService.sendMessageWithRetry(clinicConfig.ghlApiKey ?? '', {
      type: channelToMessageType(channel),
      contactId,
      locationId: clinicConfig.ghlLocationId,
      message: greeting,
      ...(ghlConversationId ? { conversationId: ghlConversationId } : {}),
      ...formatted,
    });
    ghlMessageId = sendResult?.id ?? sendResult?.messageId;
  } catch (error) {
    logger.error(
      `Failed to send greeting via GHL after retries — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
      (error as Error).stack,
    );
    await conversationsService.flagForHumanIntervention(
      conversation._id as Types.ObjectId,
      "Message delivery failed after retries",
    );
  }

  // Persist the greeting message (includes consent statement if applicable)
  await messagesService.addMessage(
    conversation._id as Types.ObjectId,
    clinicObjectId,
    conversation.leadId as Types.ObjectId,
    "ai",
    greeting,
    conversation.channel,
    ghlMessageId,
  );

  await conversationsService.updatePhase(
    conversation._id as Types.ObjectId,
    targetPhase,
  );

  logger.log(
    `${cid}New lead processed — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}, phase: ${targetPhase}`,
  );
}
