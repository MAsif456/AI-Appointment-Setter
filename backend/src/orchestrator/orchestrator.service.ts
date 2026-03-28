/** Thin coordinator — heavy logic lives in dedicated orchestrator.*.ts files. */
import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from '../ai/groq.service';
import { GreetingService } from '../ai/greeting.service';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { CancellationService } from '../cancellation/cancellation.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { GhlContactCreatePayload, GhlInboundMessagePayload } from '../webhooks/dto/ghl-webhook.dto';
import {
  FALLBACK_MESSAGE,
  POSTCODE_REGEX,
  BOOKING_KEYWORDS,
  CANCEL_KEYWORDS,
  CONFIRM_KEYWORDS,
  DECLINE_CANCEL_KEYWORDS,
  OrchestratorMessage,
  OrchestratorContext,
  IntentResult,
} from './orchestrator.types';
import { normalisePostcode, buildSingleTurnPrompt, buildMultiTurnSystemPrompt } from './orchestrator.prompts';
import { handleNewLeadFlow } from './orchestrator.new-lead';
import { handleInboundMessageFlow } from './orchestrator.inbound-message';
import {
  handleCancelIntent,
  handleConfirmCancel,
  handleDeclineCancel,
  handleCancellationReason,
} from './orchestrator.cancel-handlers';

export { FALLBACK_MESSAGE };
export type { OrchestratorMessage, OrchestratorContext, IntentResult };

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly greetingService: GreetingService,
    private readonly groqService: GroqService,
    private readonly cancellationService: CancellationService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly ghlApiService: GhlApiService,
  ) {}

  async handleNewLead(webhookData: GhlContactCreatePayload, clinicConfig: ClinicConfig): Promise<void> {
    return handleNewLeadFlow(webhookData, clinicConfig, {
      greetingService: this.greetingService,
      conversationsService: this.conversationsService,
      messagesService: this.messagesService,
      ghlApiService: this.ghlApiService,
      logger: this.logger,
    });
  }

  async handleInboundMessage(webhookData: GhlInboundMessagePayload, clinicConfig: ClinicConfig): Promise<void> {
    return handleInboundMessageFlow(webhookData, clinicConfig, {
      conversationsService: this.conversationsService,
      messagesService: this.messagesService,
      ghlApiService: this.ghlApiService,
      logger: this.logger,
      detectIntent: this.detectIntent.bind(this),
      generateResponse: this.generateResponse.bind(this),
    });
  }

  /** Detects intent based on message content and current phase (phase-gated). */
  detectIntent(messageContent: string, currentPhase: string): IntentResult {
    const lower = messageContent.toLowerCase();

    if (currentPhase === 'qualifying') {
      const postcodeMatch = messageContent.match(POSTCODE_REGEX);
      if (postcodeMatch) {
        return { intent: 'PROVIDE_POSTCODE', data: { postcode: normalisePostcode(postcodeMatch[0]) } };
      }
    }

    if (currentPhase === 'qualified') {
      if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'WANT_TO_BOOK' };
      }
    }

    // Cancellation intents — only in 'booked' phase
    if (currentPhase === 'booked') {
      if (CANCEL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'CANCEL' };
      }
    }

    // Cancellation confirmation/decline — in 'cancelling' or 'cancelling_warned' phases
    if (currentPhase === 'cancelling' || currentPhase === 'cancelling_warned') {
      if (CONFIRM_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'CONFIRM_CANCEL' };
      }
      if (DECLINE_CANCEL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'DECLINE_CANCEL' };
      }
    }

    // Graceful re-entry: lead in 'cancelled' phase wants to rebook
    if (currentPhase === 'cancelled') {
      if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'WANT_TO_BOOK' };
      }
    }

    return { intent: 'UNKNOWN' };
  }

  /** Generates an AI response based on the detected intent and conversation context. */
  async generateResponse(intent: IntentResult, context: OrchestratorContext, clinicConfig: ClinicConfig): Promise<string | null> {
    if (intent.intent === 'PROVIDE_POSTCODE') {
      const { postcode } = intent.data;
      const outwardCode = postcode.split(' ')[0];
      const isInArea =
        clinicConfig.serviceAreas && clinicConfig.serviceAreas.length > 0
          ? clinicConfig.serviceAreas.some((area) => outwardCode.toUpperCase().startsWith(area.toUpperCase()))
          : true;
      const areaContext = isInArea
        ? `The patient has provided postcode ${postcode}, which is within our service area. Confirm coverage and move the conversation towards qualification questions.`
        : `The patient has provided postcode ${postcode}, which appears to be outside our service area (${clinicConfig.serviceAreas?.join(', ') ?? 'not specified'}). Politely inform them and suggest they contact a clinic in their local area.`;
      return this.groqService.generateResponse(buildSingleTurnPrompt(areaContext, context, clinicConfig));
    }

    if (intent.intent === 'WANT_TO_BOOK') {
      const bookingContext = 'The patient has expressed intent to book an appointment. Generate a response that enthusiastically confirms this and begins collecting booking details (preferred date and time).';
      return this.groqService.generateResponse(buildSingleTurnPrompt(bookingContext, context, clinicConfig));
    }

    // Cancellation intents — delegated to extracted handlers
    if (intent.intent === 'CANCEL') {
      return handleCancelIntent(context, this.cancellationService);
    }
    if (intent.intent === 'CONFIRM_CANCEL') {
      return handleConfirmCancel(context, clinicConfig, this.cancellationService);
    }
    if (intent.intent === 'DECLINE_CANCEL') {
      return handleDeclineCancel(context);
    }

    // If awaiting a cancellation reason (freeform text), collect and proceed
    if (intent.intent === 'UNKNOWN' && context.conversationId &&
        (context.phase === 'cancelling' || context.phase === 'cancelling_warned')) {
      return handleCancellationReason(context, this.cancellationService);
    }

    // UNKNOWN: send full conversation history to the chat API
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: buildMultiTurnSystemPrompt(context, clinicConfig) },
    ];
    for (const msg of context.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }
    return this.groqService.generateChatResponse(messages);
  }

  /** Creates a structured message object representing a conversation turn. */
  createMessage(content: string, role: 'user' | 'assistant'): OrchestratorMessage {
    return { content, role, timestamp: new Date() };
  }
}
