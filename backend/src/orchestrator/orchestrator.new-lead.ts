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
 *   4. Generate a personalised AI greeting (falls back to static message on failure).
 *   5. Send the greeting to the lead via the GHL API (with retry).
 *   6. Persist the AI greeting as a message in MongoDB.
 *   7. Transition the conversation phase to 'qualifying'.
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

  // Generate the personalised AI greeting
  let greeting = await greetingService.generateGreeting(
    {
      firstName: first_name ?? "there",
      lastName: last_name,
      phone,
      email,
      issue,
      contactId,
    },
    clinicConfig,
  );

  if (!greeting) {
    logger.warn(
      `AI greeting generation failed — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}. Using fallback message.`,
    );
    greeting = FALLBACK_AI_UNAVAILABLE;
    await conversationsService.flagForHumanIntervention(
      conversation._id as Types.ObjectId,
      "AI service failure",
    );
  }

  // Send via GHL (3× retry with jitter handled by GhlApiService)
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

  // Persist the greeting and advance the phase
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
    "qualifying",
  );
  logger.log(
    `${cid}New lead processed — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
  );
}
