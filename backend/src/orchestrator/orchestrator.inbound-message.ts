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
import { SlotProvider } from '../ai/slot-provider';
import { GroqService } from '../ai/groq.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { AppointmentsService } from '../appointments/appointments.service';
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
import { handleReschedulingSlotFlow } from './orchestrator.reschedule';

/** Dependencies injected by OrchestratorService. */
export interface InboundMessageDeps {
  conversationsService: ConversationsService;
  messagesService: MessagesService;
  ghlApiService: GhlApiService;
  logger: Logger;
  detectIntent: (content: string, phase: string) => IntentResult;
  generateResponse: (intent: IntentResult, context: OrchestratorContext, config: ClinicConfig) => Promise<string | null>;
  postcodeValidationService: PostcodeValidationService;
  slotProvider: SlotProvider;
  appointmentsService: AppointmentsService;
  groqService: GroqService;
}

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

  const storedMessages = await messagesService.getByConversation(conversationObjectId);
  const contextMessages: OrchestratorMessage[] = storedMessages
    .filter((m) => m.sender !== 'system')
    .map((m) => ({
      content: m.content,
      role: (m.sender === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
      timestamp: (m as any).createdAt ?? new Date(),
    }));

  // Populate appointment context from the conversation's context Map
  const ghlApptId = conversation.context?.get('ghlAppointmentId');
  const currentAppointment = ghlApptId
    ? {
        ghlAppointmentId: ghlApptId,
        appointmentDate: conversation.context?.get('appointmentDate') ?? '',
        appointmentTime: conversation.context?.get('appointmentTime') ?? '',
      }
    : undefined;

  const context: OrchestratorContext = {
    ghlContactId: contactId,
    clinicId: clinicConfig.clinicId,
    phase: currentPhase,
    messages: contextMessages,
    patientInfo: { firstName: 'there' },
    currentAppointment,
  };

  const intent = detectIntent(messageContent, currentPhase);
  logger.log(`Intent detected: ${intent.intent} — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`);

  // Rescheduling slot flow: when the phase is 'rescheduling' and the lead is not
  // cancelling the reschedule, delegate to the dedicated slot-flow handler.
  let response: string | null = null;
  let skipPhaseUpdate = false;
  if (currentPhase === 'rescheduling' && intent.intent === 'UNKNOWN') {
    const result = await handleReschedulingSlotFlow(messageContent, conversation, contactId, context, clinicConfig, {
      slotProvider: deps.slotProvider,
      groqService: deps.groqService,
      ghlApiService,
      conversationsService,
      appointmentsService: deps.appointmentsService,
      logger,
    });
    response = result.response;
    skipPhaseUpdate = true; // phase is managed inside handleReschedulingSlotFlow
  } else {
    response = await generateResponse(intent, context, clinicConfig);
  }

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
    logger.error(`Failed to send response via GHL after retries — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`, (error as Error).stack);
  }

  await messagesService.addMessage(conversationObjectId, clinicObjectId, leadObjectId, 'ai', response, channel, ghlMessageId);

  // Advance phase (skipped when rescheduling slot flow managed it)
  if (!skipPhaseUpdate) {
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
    } else if (intent.intent === 'RESCHEDULE' && currentAppointment) {
      await conversationsService.updatePhase(conversationObjectId, 'rescheduling');
    } else if (intent.intent === 'CANCEL_RESCHEDULE') {
      await conversationsService.updatePhase(conversationObjectId, 'booked');
    }
  }

  logger.log(`Inbound message processed — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`);
}
