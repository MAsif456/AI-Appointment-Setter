import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { ConversationsService } from "../ghl/conversations.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { GhlInboundMessagePayload } from "../webhooks/dto/ghl-webhook.dto";
import { getChannelAdapter } from "../ghl/channel-adapter";
import { FALLBACK_AI_UNAVAILABLE } from "./orchestrator.types";
import {
  mapMessageTypeToChannel,
  channelToMessageType,
} from "./orchestrator.prompts";
import { ConversationsService as ChatConversationsService } from "../conversations/conversations.service";

export interface InboundMessageDeps {
  conversationsService: ConversationsService;
  ghlApiService: GhlApiService;
  logger: Logger;
  correlationId?: string;
  chatConversationsService: ChatConversationsService;
}

const EMPTY_EMAIL_FALLBACK =
  "Thanks for your message! It looks like it may have contained an attachment " +
  "or image that I can't read. Could you type out your reply instead?";

export async function handleInboundMessageFlow(
  webhookData: GhlInboundMessagePayload,
  clinicConfig: ClinicConfig,
  deps: InboundMessageDeps,
): Promise<void> {
  const { conversationsService, logger, correlationId } = deps;
  const cid = correlationId ? `[${correlationId}] ` : "";

  const contactId = webhookData.id;
  const ghlConversationId = webhookData.conversationId;

  // Detect channel from message type, falling back to the existing conversation's channel.
  const messageType = (webhookData.message?.type as string) ?? "";
  let channel = messageType ? mapMessageTypeToChannel(messageType) : "";

  if (!contactId) {
    logger.warn(
      `InboundMessage payload missing contactId — clinicId: ${clinicConfig.clinicId}. Skipping.`,
    );
    return;
  }

  const clinicObjectId = new Types.ObjectId(clinicConfig.clinicId);

  let conversation = await conversationsService.findByGhlContactId(
    contactId,
    clinicObjectId,
  );
  if (!conversation) {
    logger.log(
      `No existing conversation for contactId: ${contactId}. Creating new context.`,
    );
    try {
      conversation = await conversationsService.createForNewLead(
        clinicObjectId,
        contactId,
        ghlConversationId ?? "",
        channel,
        { firstName: "Unknown", phone: "unknown", leadSource: "other" },
      );
    } catch (error) {
      logger.error(
        `Failed to create conversation context — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
        (error as Error).stack,
      );
      return;
    }
  }

  // Fall back to the existing conversation's channel if the webhook didn't specify one
  if (!channel && conversation.channel) {
    channel = conversation.channel;
  }
  if (!channel) {
    channel = "sms";
  }

  // Ref: RFC 3834 — detect auto-replies early to prevent infinite loops
  const adapter = getChannelAdapter(channel);
  if (
    adapter.isAutoReply({
      subject: webhookData.message?.subject,
      body: webhookData.message?.body,
      from: (webhookData as Record<string, unknown>).from as string | undefined,
    })
  ) {
    logger.log(
      `${cid}Auto-reply detected — contactId: ${contactId}. Dropping silently.`,
    );
    return;
  }

  const rawContent = webhookData.message?.body ?? "";
  const messageContent = adapter.stripInbound(rawContent);

  // Capture the inbound email's Message-ID for reply threading (In-Reply-To header)
  const inboundEmailMessageId = webhookData.message?.emailMessageId;

  const conversationObjectId = conversation._id;

  if (adapter.isEmptyAfterStrip(messageContent)) {
    await sendGhlResponse(
      EMPTY_EMAIL_FALLBACK,
      channel,
      clinicConfig,
      contactId,
      deps,
      conversation.ghlConversationId,
      inboundEmailMessageId,
    );
    return;
  }

  // Delegate to the full AI pipeline (urgency, slots, booking, security, escalation)
  // Ref: Gamma et al. (1994) "Facade" pattern — https://refactoring.guru/design-patterns/facade
  let reply: string;
  try {
    const result = await deps.chatConversationsService.sendMessage(
      conversationObjectId.toHexString(),
      messageContent,
    );
    reply = result?.reply ?? FALLBACK_AI_UNAVAILABLE;
  } catch (error) {
    logger.error(
      `${cid}sendMessage failed — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
      (error as Error).stack,
    );
    await conversationsService.flagForHumanIntervention(
      conversationObjectId,
      "AI pipeline failure",
    );
    reply = FALLBACK_AI_UNAVAILABLE;
  }

  await sendGhlResponse(
    reply,
    channel,
    clinicConfig,
    contactId,
    deps,
    conversation.ghlConversationId,
    inboundEmailMessageId,
  );

  logger.log(
    `${cid}Inbound message processed — contactId: ${contactId}, conversationId: ${ghlConversationId ?? "unknown"}, clinicId: ${clinicConfig.clinicId}`,
  );
}

/**
 * Sends a response to the lead via GHL with channel-appropriate formatting.
 * Message persistence is handled by sendMessage() — this function only delivers via GHL.
 */
async function sendGhlResponse(
  response: string,
  channel: string,
  clinicConfig: ClinicConfig,
  contactId: string,
  deps: InboundMessageDeps,
  ghlConversationId?: string,
  emailMessageId?: string,
): Promise<void> {
  const { ghlApiService, logger } = deps;

  try {
    const adapter = getChannelAdapter(channel);
    const formatted = adapter.formatOutbound(
      response,
      clinicConfig.name,
      false,
    );
    await ghlApiService.sendMessageWithRetry({
      type: channelToMessageType(channel),
      contactId,
      message: response,
      ...(ghlConversationId ? { conversationId: ghlConversationId } : {}),
      ...(emailMessageId ? { emailMessageId } : {}),
      ...formatted,
    });
  } catch (error) {
    logger.error(
      `Failed to send response via GHL — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
      (error as Error).stack,
    );
  }
}
