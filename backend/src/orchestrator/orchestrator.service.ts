/**
 * Orchestrates the AI-powered conversation flow triggered by GHL webhooks.
 *
 * This class is a thin coordinator — the heavy logic lives in:
 *   - orchestrator.new-lead.ts      (handleNewLeadFlow)
 *   - orchestrator.inbound-message.ts (handleInboundMessageFlow)
 *   - orchestrator.prompts.ts       (prompt builders, channel mappers)
 *   - orchestrator.types.ts         (shared interfaces and constants)
 */
import { Injectable, Logger } from "@nestjs/common";
import { GroqService } from "../ai/groq.service";
import { GreetingService } from "../ai/greeting.service";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { ConversationsService } from "../ghl/conversations.service";
import { MessagesService } from "../ghl/messages.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import {
  GhlContactCreatePayload,
  GhlInboundMessagePayload,
} from "../webhooks/dto/ghl-webhook.dto";
import {
  FALLBACK_MESSAGE,
  INVALID_POSTCODE_RESPONSE,
  POSTCODE_REGEX,
  BOOKING_KEYWORDS,
  OrchestratorMessage,
  OrchestratorContext,
  IntentResult,
} from "./orchestrator.types";
import { PostcodeValidationService } from "./postcode-validation.service";
import {
  normalisePostcode,
  buildSingleTurnPrompt,
  buildMultiTurnSystemPrompt,
} from "./orchestrator.prompts";
import { handleNewLeadFlow } from "./orchestrator.new-lead";
import { handleInboundMessageFlow } from "./orchestrator.inbound-message";

export { FALLBACK_MESSAGE };
export type { OrchestratorMessage, OrchestratorContext, IntentResult };

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly greetingService: GreetingService,
    private readonly groqService: GroqService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly ghlApiService: GhlApiService,
    private readonly postcodeValidationService: PostcodeValidationService,
  ) {}

  async handleNewLead(
    webhookData: GhlContactCreatePayload,
    clinicConfig: ClinicConfig,
    correlationId?: string,
  ): Promise<void> {
    return handleNewLeadFlow(webhookData, clinicConfig, {
      greetingService: this.greetingService,
      conversationsService: this.conversationsService,
      messagesService: this.messagesService,
      ghlApiService: this.ghlApiService,
      logger: this.logger,
      correlationId,
    });
  }

  async handleInboundMessage(
    webhookData: GhlInboundMessagePayload,
    clinicConfig: ClinicConfig,
    correlationId?: string,
  ): Promise<void> {
    return handleInboundMessageFlow(webhookData, clinicConfig, {
      conversationsService: this.conversationsService,
      messagesService: this.messagesService,
      ghlApiService: this.ghlApiService,
      logger: this.logger,
      detectIntent: this.detectIntent.bind(this),
      generateResponse: this.generateResponse.bind(this),
      correlationId,
      postcodeValidationService: this.postcodeValidationService,
    });
  }

  /**
   * Detects the intent of an inbound message based on its content and the current phase.
   * Phase-gating: PROVIDE_POSTCODE / INVALID_POSTCODE_FORMAT only in 'qualifying',
   * WANT_TO_BOOK only in 'qualified'.
   */
  detectIntent(messageContent: string, currentPhase: string): IntentResult {
    if (currentPhase === "qualifying") {
      const postcodeMatch = messageContent.match(POSTCODE_REGEX);
      if (postcodeMatch) {
        return {
          intent: "PROVIDE_POSTCODE",
          data: { postcode: normalisePostcode(postcodeMatch[0]) },
        };
      }
      if (this.looksLikePostcodeAttempt(messageContent)) {
        return { intent: 'INVALID_POSTCODE_FORMAT' };
      }
    }

    if (currentPhase === "qualified") {
      const lower = messageContent.toLowerCase();
      if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: "WANT_TO_BOOK" };
      }
    }

    return { intent: "UNKNOWN" };
  }

  /**
   * Returns true when the whole message (stripped of whitespace) resembles a postcode
   * attempt: 3–9 characters that are entirely alphanumeric (letters and/or digits only,
   * no spaces or punctuation).  The digit requirement is intentionally omitted so that
   * random letter strings such as "ghthhdh" are also caught as invalid-format attempts.
   */
  private looksLikePostcodeAttempt(message: string): boolean {
    const stripped = message.replace(/\s+/g, '');
    return stripped.length >= 3 && stripped.length <= 9 && /^[A-Z0-9]+$/i.test(stripped);
  }

  /**
   * Generates an AI response based on the detected intent and conversation context.
   * All prompts enforce British English spelling and a 160-character response limit.
   */
  async generateResponse(
    intent: IntentResult,
    context: OrchestratorContext,
    clinicConfig: ClinicConfig,
  ): Promise<string | null> {
    if (intent.intent === "INVALID_POSTCODE_FORMAT") {
      return INVALID_POSTCODE_RESPONSE;
    }

    if (intent.intent === "PROVIDE_POSTCODE") {
      const { postcode } = intent.data;
      const outwardCode = postcode.split(" ")[0];
      const isInArea =
        clinicConfig.serviceAreas && clinicConfig.serviceAreas.length > 0
          ? clinicConfig.serviceAreas.some((area) =>
              outwardCode.toUpperCase().startsWith(area.toUpperCase()),
            )
          : true;
      const areaContext = isInArea
        ? `The patient has provided postcode ${postcode}, which is within our service area. Confirm coverage and move the conversation towards qualification questions.`
        : `The patient has provided postcode ${postcode}, which appears to be outside our service area (${clinicConfig.serviceAreas?.join(", ") ?? "not specified"}). Politely inform them and suggest they contact a clinic in their local area.`;
      return this.groqService.generateResponse(
        buildSingleTurnPrompt(areaContext, context, clinicConfig),
      );
    }

    if (intent.intent === "WANT_TO_BOOK") {
      const bookingContext =
        "The patient has expressed intent to book an appointment. Generate a response that enthusiastically confirms this and begins collecting booking details (preferred date and time).";
      return this.groqService.generateResponse(
        buildSingleTurnPrompt(bookingContext, context, clinicConfig),
      );
    }

    // UNKNOWN: send full conversation history to the chat API
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: buildMultiTurnSystemPrompt(context, clinicConfig),
      },
    ];
    for (const msg of context.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }
    return this.groqService.generateChatResponse(messages);
  }

  /** Creates a structured message object representing a conversation turn. */
  createMessage(
    content: string,
    role: "user" | "assistant",
  ): OrchestratorMessage {
    return { content, role, timestamp: new Date() };
  }
}
