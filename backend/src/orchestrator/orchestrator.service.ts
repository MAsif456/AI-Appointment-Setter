/**
 * Orchestrates the AI-powered conversation flow triggered by GHL webhooks.
 *
 * This service connects the webhook routing (US-07) to the AI services.
 * It handles two entry points: new leads (ContactCreate) and inbound messages.
 *
 * Places where the conversation context and GHL messaging services will
 * be wired in are marked with TODO comments that describe the exact function,
 * parameters, and expected return value so the integration is a direct substitution.
 */
import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from '../ai/groq.service';
import { GreetingService } from '../ai/greeting.service';
import { LeadInfo } from '../ai/interfaces/lead-info.interface';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import {
  GhlContactCreatePayload,
  GhlInboundMessagePayload,
} from '../webhooks/dto/ghl-webhook.dto';

/** Fallback message used when AI generation fails or the Groq service is unavailable. */
export const FALLBACK_MESSAGE =
  "Thanks for your message! Someone from the clinic will be in touch shortly.";

/** A single message stored in the orchestrated conversation. */
export interface OrchestratorMessage {
  /** The text content of the message. */
  content: string;
  /** Whether this message was sent by the AI or by the patient. */
  role: 'user' | 'assistant';
  /** When this message was created. */
  timestamp: Date;
}

/**
 * Minimal conversation context used by the orchestrator.
 * This is a placeholder until Suli's full ConversationContext document (US-08) is available.
 * Once US-08 is integrated, this interface will be replaced by Suli's ConversationContext type.
 */
export interface OrchestratorContext {
  /** The GHL contact ID for the lead. */
  ghlContactId?: string;
  /** The MongoDB clinic ID. */
  clinicId: string;
  /** Current phase of the conversation (e.g. 'greeting', 'qualifying', 'qualified'). */
  phase: string;
  /** All messages exchanged so far, in chronological order. */
  messages: OrchestratorMessage[];
  /** Basic patient information extracted from the webhook payload. */
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
const BOOKING_KEYWORDS = [
  'book',
  'appointment',
  'schedule',
  'sign me up',
  'yes please',
];

/**
 * Core orchestration service for AI-driven patient conversations.
 * Handles new lead greetings and inbound message responses.
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly greetingService: GreetingService,
    private readonly groqService: GroqService,
  ) {}

  /**
   * Handles a new lead from a ContactCreate GHL webhook event.
   *
   * Flow:
   *   1. Extracts lead info from the webhook payload.
   *   2. TODO: Creates a conversation context document via Suli's service.
   *   3. Generates a personalised AI greeting (or uses the fallback on failure).
   *   4. TODO: Sends the greeting to the lead via Suli's GHL messaging service.
   *   5. TODO: Updates the context with the greeting message and transitions to 'qualifying'.
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

    const leadInfo: LeadInfo = {
      firstName: first_name ?? 'there',
      lastName: last_name,
      phone,
      email,
      issue,
      contactId,
    };

    // TODO: Calls conversationContextService.createConversationContext()
    // Parameters: {
    //   clinicId: clinicConfig.clinicId,
    //   ghlContactId: contactId,
    //   patientInfo: { firstName: leadInfo.firstName, lastName: leadInfo.lastName, phone, email, issue },
    //   phase: 'greeting',
    //   messages: [],
    //   createdAt: new Date(),
    //   updatedAt: new Date(),
    // }
    // Expected return: the created context document (e.g. ConversationContext)
    // If creation fails: log the error with contactId and clinicId, then return early

    let greeting = await this.greetingService.generateGreeting(leadInfo, clinicConfig);

    if (!greeting) {
      this.logger.warn(
        `AI greeting generation failed — contactId: ${contactId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}. Using fallback message.`,
      );
      greeting = FALLBACK_MESSAGE;
    }

    // TODO: Call ghlMessagingService.sendMessage()
    // Parameters: { contactId, message: greeting, clinicConfig }
    // Expected return: { success: boolean }
    // If send fails after retries: log the error with contactId and clinicId,
    //   and flag the message with sendFailed: true on the context document

    // TODO: Add the greeting to the conversation messages array with role 'assistant' and a timestamp
    // const greetingMessage = this.createMessage(greeting, 'assistant');
    // Call conversationContextService.addMessage(contextId, greetingMessage)

    // TODO: Update conversation phase to 'qualifying'
    // TODO: Update lastMessageAt and updatedAt
    // TODO: Save the updated context
    // Call conversationContextService.updateContext(contextId, {
    //   phase: 'qualifying',
    //   lastMessageAt: new Date(),
    //   updatedAt: new Date(),
    // })

    this.logger.log(
      `New lead processed — contactId: ${contactId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
    );
  }

  /**
   * Handles an inbound message from a lead via an InboundMessage GHL webhook event.
   *
   * Flow:
   *   1. Extracts contactId, conversationId, and message content from the payload.
   *   2. TODO: Loads the existing conversation context by ghlContactId via Suli's service.
   *      If no context exists, treats the contact as a new lead and calls handleNewLead().
   *   3. TODO: Adds the inbound message to the messages array (role: 'user').
   *   4. Detects the intent of the message against the current conversation phase.
   *   5. Generates a contextually appropriate AI response (or uses the fallback on failure).
   *   6. TODO: Sends the response via Suli's GHL messaging service.
   *   7. TODO: Adds the AI response to the messages array (role: 'assistant').
   *   8. TODO: Updates lastMessageAt, updatedAt, and saves the context.
   *
   * @param webhookData - The InboundMessage payload received from GHL.
   * @param clinicConfig - The resolved clinic configuration.
   */
  async handleInboundMessage(
    webhookData: GhlInboundMessagePayload,
    clinicConfig: ClinicConfig,
  ): Promise<void> {
    const contactId = webhookData.id;
    const conversationId = webhookData.conversationId;
    const messageContent = webhookData.message?.body ?? '';

    // TODO: Attempt to load the existing conversation context by ghlContactId
    // Call conversationContextService.findByGhlContactId(contactId)
    // Expected return: OrchestratorContext | null
    // If null: treat contact as a new lead. Reconstruct a minimal GhlContactCreatePayload
    //   from available data, call handleNewLead(reconstructedPayload, clinicConfig), then return.

    // TODO: Add the inbound message to the messages array with role 'user' and a timestamp
    // const userMessage = this.createMessage(messageContent, 'user');
    // Call conversationContextService.addMessage(contextId, userMessage)

    // Placeholder: current phase will come from the loaded context (Suli's service, US-08)
    const currentPhase = 'qualifying';

    // Placeholder: full context will come from Suli's conversationContextService once US-08 is ready
    const context: OrchestratorContext = {
      ghlContactId: contactId,
      clinicId: clinicConfig.clinicId,
      phase: currentPhase,
      messages: [],
      patientInfo: { firstName: 'there' },
    };

    const intent = this.detectIntent(messageContent, currentPhase);

    this.logger.log(
      `Intent detected: ${intent.intent} — contactId: ${contactId ?? 'unknown'}, conversationId: ${conversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
    );

    let response = await this.generateResponse(intent, context, clinicConfig);

    if (!response) {
      this.logger.warn(
        `AI response generation failed — contactId: ${contactId ?? 'unknown'}, conversationId: ${conversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}. Using fallback.`,
      );
      response = FALLBACK_MESSAGE;
    }

    // TODO: Send the response via the ghlMessagingService.sendMessage()
    // Parameters: { contactId, conversationId, message: response, clinicConfig }
    // If send fails: log the error with contactId, conversationId, and clinicId

    // TODO: Add the AI response to the messages array with role 'assistant' and a timestamp
    // const assistantMessage = this.createMessage(response, 'assistant');
    // Call conversationContextService.addMessage(contextId, assistantMessage)

    // TODO: Update lastMessageAt and updatedAt
    // TODO: Save the updated context
    // Call conversationContextService.updateContext(contextId, {
    //   lastMessageAt: new Date(),
    //   updatedAt: new Date(),
    // })

    this.logger.log(
      `Inbound message processed — contactId: ${contactId ?? 'unknown'}, conversationId: ${conversationId ?? 'unknown'}, clinicId: ${clinicConfig.clinicId}`,
    );
  }

  /**
   * Detects the intent of an inbound message based on its content and the
   * current conversation phase.
   *
   * Phase-gating rules:
   *   - PROVIDE_POSTCODE is only detected when phase is 'qualifying'
   *   - WANT_TO_BOOK is only detected when phase is 'qualified'
   *
   * @param messageContent - The text of the inbound message.
   * @param currentPhase - The current phase of the conversation.
   * @returns The detected intent with any extracted data.
   */
  detectIntent(messageContent: string, currentPhase: string): IntentResult {
    // Postcode detection — only relevant during the qualifying phase
    if (currentPhase === 'qualifying') {
      const postcodeMatch = messageContent.match(POSTCODE_REGEX);
      if (postcodeMatch) {
        const postcode = this.normalisePostcode(postcodeMatch[0]);
        return { intent: 'PROVIDE_POSTCODE', data: { postcode } };
      }
    }

    // Booking intent detection — only relevant once the lead is qualified
    if (currentPhase === 'qualified') {
      const lower = messageContent.toLowerCase();
      const hasBookingIntent = BOOKING_KEYWORDS.some((kw) => lower.includes(kw));
      if (hasBookingIntent) {
        return { intent: 'WANT_TO_BOOK' };
      }
    }

    return { intent: 'UNKNOWN' };
  }

  /**
   * Generates an AI response based on the detected intent and conversation context.
   *
   * All AI prompts built by this method enforce British English spelling and a
   * 160-character response limit.
   *
   * @param intent - The detected intent from detectIntent().
   * @param context - The current conversation context.
   * @param clinicConfig - The clinic configuration.
   * @returns The AI-generated response string, or null if generation fails.
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
          : true; // No service areas configured — accept any postcode

      const areaContext = isInArea
        ? `The patient has provided postcode ${postcode}, which is within our service area. Confirm coverage and move the conversation towards qualification questions.`
        : `The patient has provided postcode ${postcode}, which appears to be outside our service area (${clinicConfig.serviceAreas?.join(', ') ?? 'not specified'}). Politely inform them and suggest they contact a clinic in their local area.`;

      const prompt = this.buildSingleTurnPrompt(areaContext, context, clinicConfig);
      return this.groqService.generateResponse(prompt);
    }

    if (intent.intent === 'WANT_TO_BOOK') {
      const bookingContext =
        'The patient has expressed intent to book an appointment. Generate a response that enthusiastically confirms this and begins collecting booking details (preferred date and time).';
      const prompt = this.buildSingleTurnPrompt(bookingContext, context, clinicConfig);
      return this.groqService.generateResponse(prompt);
    }

    // UNKNOWN: pass the full conversation history to the chat API
    const systemContent = this.buildMultiTurnSystemPrompt(context, clinicConfig);

    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [{ role: 'system', content: systemContent }];

    for (const msg of context.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    return this.groqService.generateChatResponse(messages);
  }

  /**
   * Creates a structured message object for storage in the conversation context.
   *
   * @param content - The message text.
   * @param role - Whether this message is from the AI ('assistant') or the patient ('user').
   * @returns A structured OrchestratorMessage with the current timestamp.
   */
  createMessage(content: string, role: 'user' | 'assistant'): OrchestratorMessage {
    return { content, role, timestamp: new Date() };
  }

  /**
   * Normalises a raw postcode string to uppercase with a single space before the inward code.
   * The UK inward code is always 3 characters (one digit + two letters).
   * Examples: "cf101aa" → "CF10 1AA", "CF10  1AA" → "CF10 1AA".
   */
  private normalisePostcode(raw: string): string {
    const clean = raw.replace(/\s+/g, '').toUpperCase();
    return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
  }

  /**
   * Builds a single-turn prompt for intent-specific responses (PROVIDE_POSTCODE, WANT_TO_BOOK).
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
