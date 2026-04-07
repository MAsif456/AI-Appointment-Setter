/**
 * Phase transition logic and background retry helper extracted from
 * orchestrator.inbound-message.ts to keep it under the 200-line limit.
 */
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { ConversationDocument } from '../database/schemas/conversation.schema';
import { PostcodeValidationService } from './postcode-validation.service';
import { OrchestratorContext, IntentResult } from './orchestrator.types';
import { channelToMessageType } from './orchestrator.prompts';
import { InboundMessageDeps } from './orchestrator.inbound-message';

/** Advances the conversation phase based on the detected intent and response. */
export async function applyPhaseTransition(
  intent: IntentResult,
  response: string,
  currentPhase: string,
  conversationObjectId: Types.ObjectId,
  conversation: ConversationDocument,
  clinicConfig: ClinicConfig,
  conversationsService: ConversationsService,
  postcodeValidationService: PostcodeValidationService,
): Promise<void> {
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
  } else if (intent.intent === 'RESCHEDULE' && conversation.context?.get('ghlAppointmentId')) {
    await conversationsService.updatePhase(conversationObjectId, 'rescheduling');
  } else if (intent.intent === 'CANCEL_RESCHEDULE') {
    await conversationsService.updatePhase(conversationObjectId, 'booked');
  } else if (intent.intent === 'CANCEL') {
    await conversationsService.updatePhase(conversationObjectId, 'cancelling');
  } else if (intent.intent === 'CONFIRM_CANCEL') {
    const isWarning = response.includes('incur a fee') || response.includes('Would you like to proceed');
    if (isWarning) {
      await conversationsService.updatePhase(conversationObjectId, 'cancelling_warned');
    }
  } else if (intent.intent === 'DECLINE_CANCEL') {
    if (currentPhase === 'cancelling_warned') {
      await conversationsService.updatePhase(conversationObjectId, 'rescheduling');
    } else {
      await conversationsService.updatePhase(conversationObjectId, 'booked');
    }
  } else if (intent.intent === 'DETAILS_UNCHANGED') {
    const postcode = conversation.context?.get('returningPatientPostcode');
    if (postcode) {
      await conversationsService.setContext(conversationObjectId, 'validatedPostcode', postcode);
    }
    await conversationsService.updatePhase(conversationObjectId, 'booking');
  } else if (intent.intent === 'DETAILS_CHANGED') {
    await conversationsService.updatePhase(conversationObjectId, 'qualifying');
  }
}

/** Fire-and-forget: retry AI once in the background and send follow-up if successful. */
export function backgroundRetryAiResponse(
  intent: IntentResult,
  context: OrchestratorContext,
  clinicConfig: ClinicConfig,
  deps: InboundMessageDeps,
  contactId: string,
  channel: string,
  conversationObjectId: Types.ObjectId,
  clinicObjectId: Types.ObjectId,
  leadObjectId: Types.ObjectId,
  logger: Logger,
): void {
  const { ghlApiService, messagesService, generateResponse } = deps;

  generateResponse(intent, context, clinicConfig)
    .then(async (retryResponse) => {
      if (!retryResponse) return;
      logger.log(`Background AI retry succeeded — contactId: ${contactId}`);
      const result = await ghlApiService.sendMessageWithRetry({
        type: channelToMessageType(channel),
        contactId,
        message: retryResponse,
      });
      await messagesService.addMessage(
        conversationObjectId, clinicObjectId, leadObjectId, 'ai', retryResponse, channel,
        result?.id ?? result?.messageId,
      );
    })
    .catch((err: Error) =>
      logger.warn(`Background AI retry failed — contactId: ${contactId}: ${err.message}`),
    );
}
