/**
 * Orchestrates the AI-powered conversation flow triggered by GHL webhooks.
 *
 * Connects Ali's webhook routing (US-07), Ibby's AI services (US-09),
 * and Suli's GHL messaging and conversation context services (US-08).
 *
 * Entry points:
 *   - handleNewLead    — triggered by a ContactCreate webhook event
 *   - handleInboundMessage — triggered by an InboundMessage webhook event
 */
import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { GroqService } from '../ai/groq.service';
import { GreetingService } from '../ai/greeting.service';
import { LeadInfo } from '../ai/interfaces/lead-info.interface';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { ConversationsService } from '../ghl/conversations.service';
import { ConversationDocument } from '../database/schemas/conversation.schema';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import {
  GhlContactCreatePayload,
  GhlInboundMessagePayload,
} from '../webhooks/dto/ghl-webhook.dto';

/** Fallback message used when AI generation fails or the Groq service is unavailable. */
export const FALLBACK_MESSAGE =
  "Thanks for your message! Someone from the clinic will be in touch shortly.";

/** A single message entry used to build conversation history for AI prompts. */
export interface OrchestratorMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

/**
 * Conversation context assembled from live database state.
 * Passed to generateResponse so prompts can include real history and phase.
 */
export interface OrchestratorContext {
  ghlContactId?: string;
  clinicId: string;
  phase: string;
  messages: OrchestratorMessage[];
  patientInfo: {
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    issue?: string;
  };
}

/** Discriminated union of all possible detected intents. */
export type IntentResult =
  | { intent: 'PROVIDE_POSTCODE'; data: { postcode: string } }
  | { intent: 'WANT_TO_BOOK' }
  | { intent: 'UNKNOWN' };

/** UK postcode pattern — matches both spaced (CF10 1AA) and unspaced (CF101AA) variants. */
const POSTCODE_REGEX = /[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i;

/** Keywords that indicate a lead wants to book an appointment. */
const BOOKING_KEYWORDS = ['book', 'appointment', 'schedule', 'sign me up', 'yes please'];

/** Default SMS message type used for ContactCreate events where no channel is known. */
const DEFAULT_MESSAGE_TYPE = 'SMS';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly greetingService: GreetingService,
    private readonly groqService: GroqService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly ghlApiService: GhlApiService,
  ) {}

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
   *
   * @param webhookData - The ContactCreate payload received from GHL.
   * @param clinicConfig - The resolved clinic configuration.
   */
  async handleNewLead(
    webhookData: GhlContactCreatePayload,
    clinicConfig: ClinicConfig,
  ): Promise<void> {
    const { first_name, last_name, phone, email, issue } = webhookData;
    const contactId = webhookData['id'] as string | undefined;

    if (!contactId) {
      this.logger.warn(
        `ContactCreate payload missing contactId — clinicId: ${clinicConfig.clinicId}. Skipping.`,
      );
      return;
    }

    const clinicObjectId = new Types.ObjectId(clinicConfig.clinicId);

    // Create a GHL conversation for this new contact so we have a conversationId to send messages against
    let ghlConversationId = '';
    try {
      const ghlConversation = await this.ghlApiService.createConversation(
        contactId,
        clinicConfig.ghlLocationId,
      );
      ghlConversationId =
        ghlConversation?.id ??
        ghlConversation?.conversation?.id ??
        '';
    } catch (error) {
      this.logger.warn(
        `Failed to create GHL conversation — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}. Continuing with empty conversationId. Error: ${(error as Error).message}`,
      );
    }

    // Create conversation context in MongoDB
    let conversation: ConversationDocument;
    try {
      conversation = await this.conversationsService.createForNewLead(
        clinicObjectId,
        contactId,
        ghlConversationId,
        'sms', // ContactCreate carries no channel info; default to sms
        {
          firstName: first_name ?? 'Unknown',
          phone: phone ?? 'unknown',
          leadSource: 'other',
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to create conversation context — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
        (error as Error).stack,
      );
      return;
    }

    // Generate the personalised AI greeting
    const leadInfo: LeadInfo = {
      firstName: first_name ?? 'there',
      lastName: last_name,
      phone,
      email,
      issue,
      contactId,
    };

    let greeting = await this.greetingService.generateGreeting(leadInfo, clinicConfig);

    if (!greeting) {
      this.logger.warn(
        `AI greeting generation failed — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}. Using fallback message.`,
      );
      greeting = FALLBACK_MESSAGE;
    }

    // Send the greeting via GHL (3× retry with exponential backoff is handled by GhlApiService)
    let ghlMessageId: string | undefined;
    try {
      const sendResult = await this.ghlApiService.sendMessageWithRetry({
        type: DEFAULT_MESSAGE_TYPE,
        contactId,
        message: greeting,
      });
      ghlMessageId = sendResult?.id ?? sendResult?.messageId;
    } catch (error) {
      this.logger.error(
        `Failed to send greeting via GHL after retries — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
        (error as Error).stack,
      );
    }

    // Persist the AI greeting message in MongoDB
    await this.messagesService.addMessage(
      conversation._id as Types.ObjectId,
      clinicObjectId,
      conversation.leadId as Types.ObjectId,
      'ai',
      greeting,
      conversation.channel,
      ghlMessageId,
    );

    // Move the conversation into the qualifying phase
    await this.conversationsService.updatePhase(
      conversation._id as Types.ObjectId,
      'qualifying',
    );

    this.logger.log(
      `New lead processed — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
    );
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
   *
   * @param webhookData - The InboundMessage payload received from GHL.
   * @param clinicConfig - The resolved clinic configuration.
   */
  async handleInboundMessage(
    webhookData: GhlInboundMessagePayload,
    clinicConfig: ClinicConfig,
  ): Promise<void> {
    const contactId = webhookData.id;
    const ghlConversationId = webhookData.conversationId;
    const messageContent = webhookData.message?.body ?? '';
    const rawMessageType = (webhookData.message?.type as string) ?? DEFAULT_MESSAGE_TYPE;
    const channel = this.mapMessageTypeToChannel(rawMessageType);

    if (!contactId) {
      this.logger.warn(
        `InboundMessage payload missing contactId — clinicId: ${clinicConfig.clinicId}. Skipping.`,
      );
      return;
    }

    const clinicObjectId = new Types.ObjectId(clinicConfig.clinicId);

    // Load the existing conversation, or create a new context if this contact is not yet known
    let conversation = await this.conversationsService.findByGhlContactId(
      contactId,
      clinicObjectId,
    );

    if (!conversation) {
      this.logger.log(
        `No existing conversation for contactId: ${contactId}. Creating new context.`,
      );
      try {
        conversation = await this.conversationsService.createForNewLead(
          clinicObjectId,
          contactId,
          ghlConversationId ?? '',
          channel,
          { firstName: 'Unknown', phone: 'unknown', leadSource: 'other' },
        );
      } catch (error) {
        this.logger.error(
          `Failed to create conversation context — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`,
          (error as Error).stack,
        );
        return;
      }
    }

    const conversationObjectId = conversation._id as Types.ObjectId;
    const leadObjectId = conversation.leadId as Types.ObjectId;
    const currentPhase = conversation.phase ?? 'qualifying';

    // Persist the inbound message before fetching history so it appears in the AI context
    await this.messagesService.addMessage(
      conversationObjectId,
      clinicObjectId,
      leadObjectId,
      'lead',
      messageContent,
      channel,
    );

    // Load the full conversation history (includes the message just saved above)
    const storedMessages = await this.messagesService.getByConversation(conversationObjectId);
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

    const intent = this.detectIntent(messageContent, currentPhase);

    this.logger.log(
      `Intent detected: ${intent.intent} — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
    );

    let response = await this.generateResponse(intent, context, clinicConfig);

    if (!response) {
      this.logger.warn(
        `AI response generation failed — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}. Using fallback.`,
      );
      response = FALLBACK_MESSAGE;
    }

    // Send the AI response via GHL (3× retry with exponential backoff)
    let ghlMessageId: string | undefined;
    try {
      const sendResult = await this.ghlApiService.sendMessageWithRetry({
        type: this.channelToMessageType(channel),
        contactId,
        message: response,
      });
      ghlMessageId = sendResult?.id ?? sendResult?.messageId;
    } catch (error) {
      this.logger.error(
        `Failed to send response via GHL after retries — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
        (error as Error).stack,
      );
    }

    // Persist the AI response message in MongoDB
    await this.messagesService.addMessage(
      conversationObjectId,
      clinicObjectId,
      leadObjectId,
      'ai',
      response,
      channel,
      ghlMessageId,
    );

    // Advance the conversation phase based on what was detected
    if (intent.intent === 'PROVIDE_POSTCODE') {
      await this.conversationsService.updatePhase(conversationObjectId, 'qualified');
    } else if (intent.intent === 'WANT_TO_BOOK') {
      await this.conversationsService.updatePhase(conversationObjectId, 'booking');
    }

    this.logger.log(
      `Inbound message processed — contactId: ${contactId}, conversationId: ${ghlConversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
    );
  }

  /**
   * Detects the intent of an inbound message based on its content and the current
   * conversation phase.
   *
   * Phase-gating rules:
   *   - PROVIDE_POSTCODE is only detected when phase is 'qualifying'
   *   - WANT_TO_BOOK   is only detected when phase is 'qualified'
   *
   * @param messageContent - The text of the inbound message.
   * @param currentPhase - The current phase of the conversation.
   * @returns The detected intent with any extracted data.
   */
  detectIntent(messageContent: string, currentPhase: string): IntentResult {
    if (currentPhase === 'qualifying') {
      const postcodeMatch = messageContent.match(POSTCODE_REGEX);
      if (postcodeMatch) {
        const postcode = this.normalisePostcode(postcodeMatch[0]);
        return { intent: 'PROVIDE_POSTCODE', data: { postcode } };
      }
    }

    if (currentPhase === 'qualified') {
      const lower = messageContent.toLowerCase();
      if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'WANT_TO_BOOK' };
      }
    }

    return { intent: 'UNKNOWN' };
  }

  /**
   * Generates an AI response based on the detected intent and conversation context.
   *
   * All AI prompts enforce British English spelling and a 160-character response limit.
   *
   * @param intent - The detected intent from detectIntent().
   * @param context - The current conversation context (phase, history, patient info).
   * @param clinicConfig - The clinic configuration (tone, service areas, etc.).
   * @returns The AI-generated response string, or null if the AI call fails.
   */
  async generateResponse(
    intent: IntentResult,
    context: OrchestratorContext,
    clinicConfig: ClinicConfig,
  ): Promise<string | null> {
    if (intent.intent === 'PROVIDE_POSTCODE') {
      const { postcode } = intent.data;
      const outwardCode = postcode.split(' ')[0];

      const isInArea =
        clinicConfig.serviceAreas && clinicConfig.serviceAreas.length > 0
          ? clinicConfig.serviceAreas.some((area) =>
              outwardCode.toUpperCase().startsWith(area.toUpperCase()),
            )
          : true;

      const areaContext = isInArea
        ? `The patient has provided postcode ${postcode}, which is within our service area. Confirm coverage and move the conversation towards qualification questions.`
        : `The patient has provided postcode ${postcode}, which appears to be outside our service area (${clinicConfig.serviceAreas?.join(', ') ?? 'not specified'}). Politely inform them and suggest they contact a clinic in their local area.`;

      return this.groqService.generateResponse(
        this.buildSingleTurnPrompt(areaContext, context, clinicConfig),
      );
    }

    if (intent.intent === 'WANT_TO_BOOK') {
      const bookingContext =
        'The patient has expressed intent to book an appointment. Generate a response that enthusiastically confirms this and begins collecting booking details (preferred date and time).';
      return this.groqService.generateResponse(
        this.buildSingleTurnPrompt(bookingContext, context, clinicConfig),
      );
    }

    // UNKNOWN: send full conversation history to the chat API
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: this.buildMultiTurnSystemPrompt(context, clinicConfig) },
    ];
    for (const msg of context.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }
    return this.groqService.generateChatResponse(messages);
  }

  /**
   * Creates a structured message object.
   * Used in tests and internally to represent a conversation turn.
   */
  createMessage(content: string, role: 'user' | 'assistant'): OrchestratorMessage {
    return { content, role, timestamp: new Date() };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Normalises a raw postcode to uppercase with a single space before the inward code.
   * UK inward code is always 3 characters. e.g. "cf101aa" → "CF10 1AA".
   */
  private normalisePostcode(raw: string): string {
    const clean = raw.replace(/\s+/g, '').toUpperCase();
    return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
  }

  /**
   * Maps a GHL message type string to our internal channel value.
   * Mirrors Suli's mapMessageTypeToChannel to keep the two in sync.
   */
  private mapMessageTypeToChannel(messageType: string): string {
    const map: Record<string, string> = {
      SMS: 'sms',
      WhatsApp: 'whatsapp',
      FB: 'facebook',
      IG: 'instagram',
      Email: 'email',
      Live_Chat: 'website',
      'Live Chat': 'website',
    };
    return map[messageType] ?? 'sms';
  }

  /**
   * Maps our internal channel value back to the GHL message type expected by SendMessageDto.
   */
  private channelToMessageType(channel: string): string {
    const map: Record<string, string> = {
      sms: 'SMS',
      whatsapp: 'WhatsApp',
      facebook: 'FB',
      instagram: 'IG',
      email: 'Email',
      website: 'Live_Chat',
    };
    return map[channel] ?? 'SMS';
  }

  /**
   * Builds a single-turn prompt for intent-specific responses.
   * Enforces British English spelling and the 160-character response limit.
   */
  private buildSingleTurnPrompt(
    situationContext: string,
    context: OrchestratorContext,
    clinicConfig: ClinicConfig,
  ): string {
    const toneInstruction =
      clinicConfig.tone === 'Professional'
        ? 'Use a formal, businesslike, and respectful tone. Be courteous and precise.'
        : 'Use a warm, casual, and conversational tone. Be approachable and empathetic.';

    const parts = [
      `You are the receptionist for ${clinicConfig.name}.`,
      toneInstruction,
      '',
      `Current situation: ${situationContext}`,
      '',
      'Rules:',
      '- Use British English spelling throughout (e.g. organise, centre, colour, neighbour)',
      '- Keep the response under 160 characters',
      '- Do NOT use emojis or hashtags',
      '- Do NOT reveal what technology or system powers you',
      '- Sound like a real person at the clinic reception desk',
    ];

    if (clinicConfig.customInstructions) {
      parts.push(`- ${clinicConfig.customInstructions}`);
    }

    if (context.patientInfo.firstName && context.patientInfo.firstName !== 'there') {
      parts.push(`\nPatient name: ${context.patientInfo.firstName}`);
    }

    return parts.join('\n');
  }

  /**
   * Builds the system prompt for multi-turn UNKNOWN intent responses.
   * Guides the AI to generate contextually appropriate replies that steer the
   * conversation back towards the current phase's goal.
   */
  private buildMultiTurnSystemPrompt(
    context: OrchestratorContext,
    clinicConfig: ClinicConfig,
  ): string {
    const toneInstruction =
      clinicConfig.tone === 'Professional'
        ? 'Use a formal, businesslike, and respectful tone. Be courteous and precise.'
        : 'Use a warm, casual, and conversational tone. Be approachable and empathetic.';

    const parts = [
      `You are the booking receptionist for ${clinicConfig.name}.`,
      toneInstruction,
      '',
      `Current conversation phase: ${context.phase ?? 'qualifying'}`,
      'Your goal is to guide the patient towards booking an appointment.',
      'Generate a response that is contextually appropriate and steers the conversation back towards the current phase goal.',
      '',
      'Rules:',
      '- Use British English spelling throughout (e.g. organise, centre, colour, neighbour)',
      '- Keep responses under 160 characters',
      '- Do NOT use emojis or hashtags',
      '- Do NOT reveal what technology or system powers you',
      '- Sound like a real person at the clinic reception desk',
    ];

    if (clinicConfig.customInstructions) {
      parts.push(`- ${clinicConfig.customInstructions}`);
    }

    return parts.join('\n');
  }
}
