/**
 * Standalone handler for the InboundMessage webhook flow.
 *
 * Extracted from OrchestratorService to keep each file under the 200-line limit.
 * Receives its dependencies as a plain object so it can be called from the
 * injectable service without coupling to NestJS DI.
 */
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { GhlInboundMessagePayload } from '../webhooks/dto/ghl-webhook.dto';
import {
  FALLBACK_MESSAGE,
  DEFAULT_MESSAGE_TYPE,
  OrchestratorMessage,
  OrchestratorContext,
  IntentResult,
} from './orchestrator.types';
import { mapMessageTypeToChannel, channelToMessageType } from './orchestrator.prompts';
import { PostcodeValidationService } from './postcode-validation.service';

/** Dependencies injected by OrchestratorService. */
export interface InboundMessageDeps {
  conversationsService: ConversationsService;
  messagesService: MessagesService;
  ghlApiService: GhlApiService;
  logger: Logger;
  detectIntent: (content: string, phase: string) => IntentResult;
  generateResponse: (intent: IntentResult, context: OrchestratorContext, config: ClinicConfig) => Promise<string | null>;
  postcodeValidationService: PostcodeValidationService;
}

/**
 * Handles an inbound message from a lead via an InboundMessage GHL webhook event.
 *
 * Flow:
 *   1. Validate contactId is present.
 *   2. Load the existing conversation context from MongoDB, or create one for unknown contacts.
 *   3. Persist the inbound message (sender: 'lead') in MongoDB.
 *   4. Load the full conversation history to pass as context to the AI.
 *   5. Detect intent (postcode, booking, or unknown) against the current phase.
 *   6. Generate a contextually appropriate AI response (falls back on failure).
 *   7. Send the response via the GHL API (with retry).
 *   8. Persist the AI response message (sender: 'ai') in MongoDB.
 *   9. Advance the conversation phase if the intent warrants it.
 */
export async function handleInboundMessageFlow(
  webhookData: GhlInboundMessagePayload,
  clinicConfig: ClinicConfig,
  deps: InboundMessageDeps,
): Promise<void> {
  const { conversationsService, messagesService, ghlApiService, logger, detectIntent, generateResponse, postcodeValidationService } = deps;

  const contactId = webhookData.id;
  const ghlConversationId = webhookData.conversationId;
  const messageContent = webhookData.message?.body ?? '';
  const channel = mapMessageTypeToChannel((webhookData.message?.type as string) ?? DEFAULT_MESSAGE_TYPE);

  if (!contactId) {
    logger.warn(`InboundMessage payload missing contactId — clinicId: ${clinicConfig.clinicId}. Skipping.`);
    return;
  }

  const clinicObjectId = new Types.ObjectId(clinicConfig.clinicId);

  // Load or create conversation context
  let conversation = await conversationsService.findByGhlContactId(contactId, clinicObjectId);

  if (!conversation) {
    logger.log(`No existing conversation for contactId: ${contactId}. Creating new context.`);
    try {
      conversation = await conversationsService.createForNewLead(
        clinicObjectId,
        contactId,
        ghlConversationId ?? '',
        channel,
        { firstName: 'Unknown', phone: 'unknown', leadSource: 'other' },
      );
    } catch (error) {
      logger.error(
        `Failed to create conversation context — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
        (error as Error).stack,
      );
      return;
    }
  }

  const conversationObjectId = conversation._id as Types.ObjectId;
  const leadObjectId = conversation.leadId as Types.ObjectId;
  const currentPhase = conversation.phase ?? 'qualifying';

  // Persist the inbound message
  await messagesService.addMessage(conversationObjectId, clinicObjectId, leadObjectId, 'lead', messageContent, channel);

  // Load history and build context
  const storedMessages = await messagesService.getByConversation(conversationObjectId);
  const contextMessages: OrchestratorMessage[] = storedMessages
    .filter((m) => m.sender !== 'system')
    .map((m) => ({
      content: m.content,
      role: (m.sender === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
      timestamp: (m as any).createdAt ?? new Date(),
    }));

  const context: OrchestratorContext = {
    ghlContactId: contactId,
    clinicId: clinicConfig.clinicId,
    phase: currentPhase,
    conversationId: conversationObjectId.toHexString(),
    messages: contextMessages,
    patientInfo: { firstName: 'there' },
  };

  const intent = detectIntent(messageContent, currentPhase);
  logger.log(`Intent detected: ${intent.intent} — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`);

  let response = await generateResponse(intent, context, clinicConfig);
  if (!response) {
    logger.warn(`AI response generation failed — contactId: ${contactId}. Using fallback.`);
    response = FALLBACK_MESSAGE;
  }

  // Send via GHL
  let ghlMessageId: string | undefined;
  try {
    const sendResult = await ghlApiService.sendMessageWithRetry({ type: channelToMessageType(channel), contactId, message: response });
    ghlMessageId = sendResult?.id ?? sendResult?.messageId;
  } catch (error) {
    logger.error(
      `Failed to send response via GHL after retries — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
      (error as Error).stack,
    );
  }

  // Persist AI response
  await messagesService.addMessage(conversationObjectId, clinicObjectId, leadObjectId, 'ai', response, channel, ghlMessageId);

  // Advance phase based on detected intent
  if (intent.intent === 'PROVIDE_POSTCODE') {
    const { postcode } = intent.data;
    const inArea = postcodeValidationService.isInServiceArea(postcode, clinicConfig.serviceAreas ?? []);
    if (inArea) {
      await conversationsService.setContext(conversationObjectId, 'validatedPostcode', postcode);
      await conversationsService.updatePhase(conversationObjectId, 'qualified');
    } else {
      await conversationsService.updatePhase(conversationObjectId, 'declined');
    }
  } else if (intent.intent === 'WANT_TO_BOOK') {
    await conversationsService.updatePhase(conversationObjectId, 'booking');
  } else if (intent.intent === 'CANCEL') {
    await conversationsService.updatePhase(conversationObjectId, 'cancelling');
  } else if (intent.intent === 'CONFIRM_CANCEL') {
    // If response is a fee warning, move to cancelling_warned; otherwise executeCancellation already set 'cancelled'
    const isWarning = response.includes('incur a fee') || response.includes('Would you like to proceed');
    if (isWarning) {
      await conversationsService.updatePhase(conversationObjectId, 'cancelling_warned');
    }
    // Note: if cancellation was executed, CancellationService already set phase to 'cancelled'
  } else if (intent.intent === 'DECLINE_CANCEL') {
    if (currentPhase === 'cancelling_warned') {
      await conversationsService.updatePhase(conversationObjectId, 'rescheduling');
    } else {
      await conversationsService.updatePhase(conversationObjectId, 'booked');
    }
  }

  logger.log(`Inbound message processed — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`);
}
