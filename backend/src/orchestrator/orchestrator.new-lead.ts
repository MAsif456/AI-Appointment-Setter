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
import {
  FALLBACK_AI_UNAVAILABLE,
  DEFAULT_MESSAGE_TYPE,
} from "./orchestrator.types";

/** Dependencies injected by OrchestratorService. */
export interface NewLeadDeps {
  greetingService: GreetingService;
  conversationsService: ConversationsService;
  messagesService: MessagesService;
  ghlApiService: GhlApiService;
  patientHistoryService: PatientHistoryService;
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

  // Create conversation context in MongoDB
  let conversation;
  try {
    conversation = await conversationsService.createForNewLead(
      clinicObjectId,
      contactId,
      ghlConversationId,
      "sms",
      {
        firstName: first_name ?? "Unknown",
        phone: phone ?? "unknown",
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

  // Send via GHL (3x retry with jitter handled by GhlApiService)
  let ghlMessageId: string | undefined;
  try {
    const sendResult = await ghlApiService.sendMessageWithRetry({
      type: DEFAULT_MESSAGE_TYPE,
      contactId,
      message: greeting,
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

  // Persist the greeting message
  await messagesService.addMessage(
    conversation._id as Types.ObjectId,
    clinicObjectId,
    conversation.leadId as Types.ObjectId,
    "ai",
    greeting,
    conversation.channel,
    ghlMessageId,
  );

  // Returning patients stay in 'greeting' so the next reply can be detected as
  // DETAILS_UNCHANGED or DETAILS_CHANGED before moving to booking or qualifying.
  // New patients advance directly to 'qualifying'.
  const targetPhase = returningPatient ? "greeting" : "qualifying";
  await conversationsService.updatePhase(
    conversation._id as Types.ObjectId,
    targetPhase,
  );

  logger.log(
    `${cid}New lead processed — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}, phase: ${targetPhase}`,
  );
}
