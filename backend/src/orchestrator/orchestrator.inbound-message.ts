/** Standalone handler for the InboundMessage webhook flow. */
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { SlotProvider } from '../ai/slot-provider';
import { GroqService } from '../ai/groq.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { GhlInboundMessagePayload } from '../webhooks/dto/ghl-webhook.dto';
import {
  FALLBACK_AI_UNAVAILABLE,
  DEFAULT_MESSAGE_TYPE,
  OrchestratorContext,
  IntentResult,
} from './orchestrator.types';
import { mapMessageTypeToChannel, channelToMessageType } from './orchestrator.prompts';
import { PostcodeValidationService } from './postcode-validation.service';
import { SecurityPipelineService } from '../security/security-pipeline.service';
import { handleReschedulingSlotFlow } from './orchestrator.reschedule';
import { applyPhaseTransition, backgroundRetryAiResponse } from './orchestrator.phase-transitions';
import { buildInboundContext } from './orchestrator.context-builder';

/** Dependencies injected by OrchestratorService. */
export interface InboundMessageDeps {
  conversationsService: ConversationsService;
  messagesService: MessagesService;
  ghlApiService: GhlApiService;
  logger: Logger;
  detectIntent: (
    content: string,
    phase: string,
    context?: Pick<OrchestratorContext, 'isReturningPatient'>,
  ) => IntentResult;
  generateResponse: (
    intent: IntentResult,
    context: OrchestratorContext,
    config: ClinicConfig,
  ) => Promise<string | null>;
  correlationId?: string;
  postcodeValidationService: PostcodeValidationService;
  slotProvider: SlotProvider;
  appointmentsService: AppointmentsService;
  groqService: GroqService;
  securityPipeline: SecurityPipelineService;
}

export async function handleInboundMessageFlow(
  webhookData: GhlInboundMessagePayload,
  clinicConfig: ClinicConfig,
  deps: InboundMessageDeps,
): Promise<void> {
  const {
    conversationsService,
    messagesService,
    ghlApiService,
    logger,
    detectIntent,
    generateResponse,
    correlationId,
    postcodeValidationService,
    securityPipeline,
  } = deps;
  const cid = correlationId ? `[${correlationId}] ` : '';

  const contactId = webhookData.id;
  const ghlConversationId = webhookData.conversationId;
  const messageContent = webhookData.message?.body ?? '';
  const channel = mapMessageTypeToChannel(
    (webhookData.message?.type as string) ?? DEFAULT_MESSAGE_TYPE,
  );

  if (!contactId) {
    logger.warn(
      `InboundMessage payload missing contactId — clinicId: ${clinicConfig.clinicId}. Skipping.`,
    );
    return;
  }

  const clinicObjectId = new Types.ObjectId(clinicConfig.clinicId);

  // Load or create conversation context
  let conversation = await conversationsService.findByGhlContactId(contactId, clinicObjectId);

  if (!conversation) {
    logger.log(`No existing conversation for contactId: ${contactId}. Creating new context.`);
    try {
      conversation = await conversationsService.createForNewLead(
        clinicObjectId, contactId, ghlConversationId ?? '', channel,
        { firstName: 'Unknown', phone: 'unknown', leadSource: 'other' },
      );
    } catch (error) {
      logger.error(`Failed to create conversation context — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`, (error as Error).stack);
      return;
    }
  }

  const conversationObjectId = conversation._id as Types.ObjectId;
  const leadObjectId = conversation.leadId as Types.ObjectId;
  const currentPhase = conversation.phase ?? 'qualifying';

  await messagesService.addMessage(conversationObjectId, clinicObjectId, leadObjectId, 'lead', messageContent, channel);

  const securityResult = await securityPipeline.processInbound(
    messageContent,
    conversationObjectId.toString(),
    clinicObjectId.toString(),
    currentPhase,
    leadObjectId.toString(),
  );

  let response: string;
  let intent: IntentResult = { intent: 'UNKNOWN' };

  if (!securityResult.allowed) {
    logger.warn(
      `${cid}Security pipeline blocked message — contactId: ${contactId}, score: ${securityResult.threatScore.toFixed(2)}`,
    );
    response = securityResult.fallbackResponse ?? FALLBACK_AI_UNAVAILABLE;
  } else {
    const sanitisedContent = securityResult.sanitisedMessage;
    const context = await buildInboundContext(
      conversation, contactId, clinicConfig, currentPhase, conversationObjectId, messagesService,
    );

    intent = detectIntent(sanitisedContent, currentPhase, { isReturningPatient: context.isReturningPatient });
    logger.log(
      `${cid}Intent detected: ${intent.intent} — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
    );

    // Rescheduling slot flow: when in 'rescheduling' phase and no CANCEL_RESCHEDULE detected
    if (currentPhase === 'rescheduling' && intent.intent === 'UNKNOWN') {
      const result = await handleReschedulingSlotFlow(
        sanitisedContent, conversation, contactId, context, clinicConfig, {
          slotProvider: deps.slotProvider,
          groqService: deps.groqService,
          ghlApiService,
          conversationsService,
          appointmentsService: deps.appointmentsService,
          logger,
        },
      );
      response = result.response;
    } else {
      const aiResult = await generateResponse(intent, context, clinicConfig);
      const aiFailed = !aiResult;
      let aiResponse: string = aiResult ?? FALLBACK_AI_UNAVAILABLE;

      if (aiFailed) {
        logger.warn(`${cid}AI response generation failed — contactId: ${contactId}. Using fallback.`);
        await conversationsService.flagForHumanIntervention(conversationObjectId, 'AI service failure');
        backgroundRetryAiResponse(intent, context, clinicConfig, deps, contactId, channel, conversationObjectId, clinicObjectId, leadObjectId, logger);
      }

      // Output validation: check AI response before sending to patient
      if (aiResult) {
        const outputCheck = securityPipeline.validateOutput(aiResponse, currentPhase);
        if (!outputCheck.safe) {
          logger.warn(`${cid}Output validation failed — flags: ${outputCheck.flags.join(',')} — contactId: ${contactId}`);
          aiResponse = outputCheck.fallbackResponse ?? FALLBACK_AI_UNAVAILABLE;
        }
      }

      response = aiResponse;
    }
  }

  // Send via GHL
  let ghlMessageId: string | undefined;
  try {
    const sendResult = await ghlApiService.sendMessageWithRetry({
      type: channelToMessageType(channel),
      contactId,
      message: response,
    });
    ghlMessageId = sendResult?.id ?? sendResult?.messageId;
  } catch (error) {
    logger.error(
      `${cid}Failed to send response via GHL after retries — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
      (error as Error).stack,
    );
    await conversationsService.flagForHumanIntervention(conversationObjectId, 'Message delivery failed after retries');
  }

  // Persist AI response
  await messagesService.addMessage(conversationObjectId, clinicObjectId, leadObjectId, 'ai', response, channel, ghlMessageId);

  // Advance phase based on detected intent (only when security allowed the message through)
  if (securityResult.allowed) {
    await applyPhaseTransition(
      intent, response, currentPhase, conversationObjectId, conversation,
      clinicConfig, conversationsService, postcodeValidationService,
    );
  }

  logger.log(
    `${cid}Inbound message processed — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
  );
}
