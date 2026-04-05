import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { ConversationsService } from "../ghl/conversations.service";
import { MessagesService } from "../ghl/messages.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { GhlInboundMessagePayload } from "../webhooks/dto/ghl-webhook.dto";
import { getChannelAdapter } from "../ghl/channel-adapter";
import {
  FALLBACK_AI_UNAVAILABLE,
  DEFAULT_MESSAGE_TYPE,
  OrchestratorMessage,
  OrchestratorContext,
  IntentResult,
} from "./orchestrator.types";
import {
  mapMessageTypeToChannel,
  channelToMessageType,
} from "./orchestrator.prompts";
import { PostcodeValidationService } from "./postcode-validation.service";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { backgroundRetryAiResponse } from "./orchestrator.background-retry";
import { advancePhaseFromIntent } from "./orchestrator.phase-advancement";

export interface InboundMessageDeps {
  conversationsService: ConversationsService;
  messagesService: MessagesService;
  ghlApiService: GhlApiService;
  logger: Logger;
  detectIntent: (
    content: string,
    phase: string,
    context?: Pick<OrchestratorContext, "isReturningPatient">,
  ) => IntentResult;
  generateResponse: (
    intent: IntentResult,
    context: OrchestratorContext,
    config: ClinicConfig,
  ) => Promise<string | null>;
  correlationId?: string;
  postcodeValidationService: PostcodeValidationService;
  securityPipeline: SecurityPipelineService;
}

const EMPTY_EMAIL_FALLBACK =
  "Thanks for your message! It looks like it may have contained an attachment " +
  "or image that I can't read. Could you type out your reply instead?";

export async function handleInboundMessageFlow(
  webhookData: GhlInboundMessagePayload,
  clinicConfig: ClinicConfig,
  deps: InboundMessageDeps,
): Promise<void> {
  const {
    conversationsService,
    messagesService,
    logger,
    correlationId,
    postcodeValidationService,
  } = deps;
  const cid = correlationId ? `[${correlationId}] ` : "";

  const contactId = webhookData.id;
  const ghlConversationId = webhookData.conversationId;

  // Detect channel from message type, falling back to the existing conversation's channel.
  // GHL InboundMessage webhooks may omit message.type for email replies, which would
  // incorrectly default to SMS and cause a 422 when the contact has no phone number.
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

  // Ref: RFC 3834 (https://datatracker.ietf.org/doc/html/rfc3834) — detect auto-replies early to prevent infinite loops
  const adapter = getChannelAdapter(channel);
  if (
    adapter.isAutoReply({
      subject: webhookData.message?.subject,
      body: webhookData.message?.body,
      from: (webhookData as any).from,
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
  const leadObjectId = conversation.leadId;
  const currentPhase = conversation.phase ?? "qualifying";

  await messagesService.addMessage(
    conversationObjectId,
    clinicObjectId,
    leadObjectId,
    "lead",
    messageContent,
    channel,
  );

  if (adapter.isEmptyAfterStrip(messageContent)) {
    await sendResponse(
      EMPTY_EMAIL_FALLBACK,
      channel,
      clinicConfig,
      contactId,
      conversationObjectId,
      clinicObjectId,
      leadObjectId,
      deps,
      conversation.ghlConversationId,
      inboundEmailMessageId,
    );
    return;
  }

  const { response, intent, securityAllowed } = await generateSafeResponse(
    messageContent,
    currentPhase,
    contactId,
    conversationObjectId,
    clinicObjectId,
    leadObjectId,
    channel,
    clinicConfig,
    conversation,
    deps,
  );

  await sendResponse(
    response,
    channel,
    clinicConfig,
    contactId,
    conversationObjectId,
    clinicObjectId,
    leadObjectId,
    deps,
    conversation.ghlConversationId,
    inboundEmailMessageId,
  );

  if (securityAllowed) {
    await advancePhaseFromIntent(
      intent,
      response,
      currentPhase,
      conversationObjectId,
      conversation as any,
      conversationsService,
      postcodeValidationService,
      clinicConfig,
    );
  }

  logger.log(
    `${cid}Inbound message processed — contactId: ${contactId}, conversationId: ${ghlConversationId ?? "unknown"}, clinicId: ${clinicConfig.clinicId}`,
  );
}

async function generateSafeResponse(
  messageContent: string,
  currentPhase: string,
  contactId: string,
  conversationObjectId: Types.ObjectId,
  clinicObjectId: Types.ObjectId,
  leadObjectId: Types.ObjectId,
  channel: string,
  clinicConfig: ClinicConfig,
  conversation: any,
  deps: InboundMessageDeps,
): Promise<{
  response: string;
  intent: IntentResult;
  securityAllowed: boolean;
}> {
  const {
    conversationsService,
    messagesService,
    logger,
    detectIntent,
    generateResponse,
    correlationId,
    securityPipeline,
  } = deps;
  const cid = correlationId ? `[${correlationId}] ` : "";

  const securityResult = await securityPipeline.processInbound(
    messageContent,
    conversationObjectId.toString(),
    clinicObjectId.toString(),
    currentPhase,
    leadObjectId.toString(),
  );

  let intent: IntentResult = { intent: "UNKNOWN" };
  if (!securityResult.allowed) {
    logger.warn(
      `${cid}Security pipeline blocked — contactId: ${contactId}, score: ${securityResult.threatScore.toFixed(2)}`,
    );
    return {
      response: securityResult.fallbackResponse ?? FALLBACK_AI_UNAVAILABLE,
      intent,
      securityAllowed: false,
    };
  }

  const storedMessages =
    await messagesService.getByConversation(conversationObjectId);
  const contextMessages: OrchestratorMessage[] = storedMessages
    .filter((m) => m.sender !== "system")
    .map((m) => ({
      content: m.content,
      role: m.sender === "ai" ? "assistant" : "user",
      timestamp: (m as any).createdAt ?? new Date(),
    }));

  // Load lead from DB so the AI knows the patient's name, issue, and postcode
  const lead = await conversationsService.findLeadById(
    leadObjectId as Types.ObjectId,
  );
  const validatedPostcode = conversation?.context?.get("validatedPostcode");

  const context: OrchestratorContext = {
    ghlContactId: contactId,
    clinicId: clinicConfig.clinicId,
    phase: currentPhase,
    conversationId: conversationObjectId.toHexString(),
    messages: contextMessages,
    patientInfo: {
      firstName: lead?.firstName ?? "there",
      lastName: lead?.lastName,
      phone: lead?.phone,
      email: lead?.email,
      issue: lead?.issue,
      validatedPostcode,
    },
    isReturningPatient: conversation?.isReturningPatient ?? false,
    channel,
  };

  intent = detectIntent(securityResult.sanitisedMessage, currentPhase, {
    isReturningPatient: context.isReturningPatient,
  });
  logger.log(
    `${cid}Intent detected: ${intent.intent} — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
  );

  const aiResult = await generateResponse(intent, context, clinicConfig);
  let aiResponse: string = aiResult ?? FALLBACK_AI_UNAVAILABLE;

  if (!aiResult) {
    logger.warn(
      `${cid}AI response generation failed — contactId: ${contactId}. Using fallback.`,
    );
    await conversationsService.flagForHumanIntervention(
      conversationObjectId,
      "AI service failure",
    );
    backgroundRetryAiResponse(
      intent,
      context,
      clinicConfig,
      deps,
      contactId,
      channel,
      conversationObjectId,
      clinicObjectId,
      leadObjectId,
      conversation.ghlConversationId,
    );
  } else {
    const outputCheck = securityPipeline.validateOutput(
      aiResponse,
      currentPhase,
    );
    if (!outputCheck.safe) {
      logger.warn(
        `${cid}Output validation failed — flags: ${outputCheck.flags.join(",")} — contactId: ${contactId}`,
      );
      aiResponse = outputCheck.fallbackResponse ?? FALLBACK_AI_UNAVAILABLE;
    }
  }

  return { response: aiResponse, intent, securityAllowed: true };
}

async function sendResponse(
  response: string,
  channel: string,
  clinicConfig: ClinicConfig,
  contactId: string,
  conversationObjectId: Types.ObjectId,
  clinicObjectId: Types.ObjectId,
  leadObjectId: Types.ObjectId,
  deps: InboundMessageDeps,
  ghlConversationId?: string,
  emailMessageId?: string,
): Promise<void> {
  const { ghlApiService, messagesService, conversationsService, logger } = deps;

  let ghlMessageId: string | undefined;
  try {
    const adapter = getChannelAdapter(channel);
    const formatted = adapter.formatOutbound(
      response,
      clinicConfig.name,
      false,
    );
    const sendResult = await ghlApiService.sendMessageWithRetry({
      type: channelToMessageType(channel),
      contactId,
      message: response,
      ...(ghlConversationId ? { conversationId: ghlConversationId } : {}),
      ...(emailMessageId ? { emailMessageId } : {}),
      ...formatted,
    });
    ghlMessageId = sendResult?.id ?? sendResult?.messageId;
  } catch (error) {
    logger.error(
      `Failed to send response via GHL — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
      (error as Error).stack,
    );
    await conversationsService.flagForHumanIntervention(
      conversationObjectId,
      "Message delivery failed after retries",
    );
  }

  await messagesService.addMessage(
    conversationObjectId,
    clinicObjectId,
    leadObjectId,
    "ai",
    response,
    channel,
    ghlMessageId,
  );
}
