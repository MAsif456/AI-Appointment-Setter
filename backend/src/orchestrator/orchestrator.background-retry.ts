import { Types } from 'mongoose';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { GhlApiService } from '../ghl/ghl-api.service';
import { MessagesService } from '../ghl/messages.service';
import { formatEmailHtml, formatEmailSubject } from '../ghl/email-formatter';
import { channelToMessageType } from './orchestrator.prompts';
import { OrchestratorContext, IntentResult } from './orchestrator.types';
import { Logger } from '@nestjs/common';

export interface BackgroundRetryDeps {
  ghlApiService: GhlApiService;
  messagesService: MessagesService;
  logger: Logger;
  generateResponse: (
    intent: IntentResult,
    context: OrchestratorContext,
    config: ClinicConfig,
  ) => Promise<string | null>;
}

/**
 * Background AI retry function that sends a retry message to the contact if the AI response generation failed.
 * @param intent - The intent result that triggered the retry.
 * @param context - The orchestrator context that contains the conversation history and lead information.
 * @param clinicConfig - The clinic configuration that contains the greeting template and custom instructions.
 * @param deps - The dependencies required to send the retry message.
 * @param contactId - The GHL contact ID of the lead.
 * @param channel - The channel to send the retry message through.
 * @param conversationObjectId - The MongoDB ObjectId of the conversation.
 * @param clinicObjectId - The MongoDB ObjectId of the clinic.
 * @param leadObjectId - The MongoDB ObjectId of the lead.
 */
export function backgroundRetryAiResponse(
  intent: IntentResult,
  context: OrchestratorContext,
  clinicConfig: ClinicConfig,
  deps: BackgroundRetryDeps,
  contactId: string,
  channel: string,
  conversationObjectId: Types.ObjectId,
  clinicObjectId: Types.ObjectId,
  leadObjectId: Types.ObjectId,
): void {
  const { ghlApiService, messagesService, logger, generateResponse } = deps;

  generateResponse(intent, context, clinicConfig)
    .then(async (retryResponse) => {
      if (!retryResponse) return;
      logger.log(`Background AI retry succeeded — contactId: ${contactId}`);
      const result = await ghlApiService.sendMessageWithRetry({
        type: channelToMessageType(channel),
        contactId,
        message: retryResponse,
        ...(channel === 'email' ? {
          subject: formatEmailSubject(clinicConfig.name, false),
          html: formatEmailHtml(retryResponse, clinicConfig.name),
        } : {}),
      });
      await messagesService.addMessage(
        conversationObjectId,
        clinicObjectId,
        leadObjectId,
        'ai',
        retryResponse,
        channel,
        result?.id ?? result?.messageId,
      );
    })
    .catch((err) =>
      logger.warn(
        `Background AI retry failed — contactId: ${contactId}: ${(err as Error).message}`,
      ),
    );
}
