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
import { SecurityPipelineService } from '../security/security-pipeline.service';

/** Dependencies injected by OrchestratorService. */
export interface InboundMessageDeps {
  conversationsService: ConversationsService;
  messagesService: MessagesService;
  ghlApiService: GhlApiService;
  logger: Logger;
  detectIntent: (content: string, phase: string) => IntentResult;
  generateResponse: (intent: IntentResult, context: OrchestratorContext, config: ClinicConfig) => Promise<string | null>;
  postcodeValidationService: PostcodeValidationService;
  securityPipeline: SecurityPipelineService;
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
  const { conversationsService, messagesService, ghlApiService, logger, detectIntent, generateResponse, postcodeValidationService, securityPipeline } = deps;

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

  // Security pipeline: sanitise input, detect injection, enforce boundaries
  const securityResult = await securityPipeline.processInbound(
    messageContent,
    conversationObjectId.toString(),
    clinicObjectId.toString(),
    currentPhase,
    leadObjectId.toString(),
  );

  let response: string;

  if (!securityResult.allowed) {
    logger.warn(
      `Security pipeline blocked message — contactId: ${contactId}, score: ${securityResult.threatScore.toFixed(2)}`,
    );
    response = securityResult.fallbackResponse ?? FALLBACK_MESSAGE;
  } else {
    // Use sanitised message for intent detection and AI processing
    const sanitisedContent = securityResult.sanitisedMessage;

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
      messages: contextMessages,
      patientInfo: { firstName: 'there' },
    };

    const intent = detectIntent(sanitisedContent, currentPhase);
    logger.log(`Intent detected: ${intent.intent} — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`);

    let aiResponse = await generateResponse(intent, context, clinicConfig);

    // Output validation: check AI response before sending to patient
    if (aiResponse) {
      const outputCheck = securityPipeline.validateOutput(aiResponse, currentPhase);
      if (!outputCheck.safe) {
        logger.warn(
          `Output validation failed — flags: ${outputCheck.flags.join(',')} — contactId: ${contactId}`,
        );
        aiResponse = outputCheck.fallbackResponse ?? FALLBACK_MESSAGE;
      }
    }

    if (!aiResponse) {
      logger.warn(`AI response generation failed — contactId: ${contactId}. Using fallback.`);
      aiResponse = FALLBACK_MESSAGE;
    }
    response = aiResponse;

    // Advance phase (only when security allowed the message through)
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
    }
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

  logger.log(`Inbound message processed — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`);
}
