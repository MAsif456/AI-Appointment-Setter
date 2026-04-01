/**
 * Orchestrates the AI-powered conversation flow triggered by GHL webhooks.
 *
 * This class is a thin coordinator — the heavy logic lives in:
 *   - orchestrator.new-lead.ts        (handleNewLeadFlow)
 *   - orchestrator.inbound-message.ts (handleInboundMessageFlow)
 *   - orchestrator.reschedule.ts      (handleReschedulingSlotFlow)
 *   - orchestrator.prompts.ts         (prompt builders, channel mappers)
 *   - orchestrator.types.ts           (shared interfaces and constants)
 */
import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from '../ai/groq.service';
import { GreetingService } from '../ai/greeting.service';
import { SlotProvider } from '../ai/slot-provider';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { GhlContactCreatePayload, GhlInboundMessagePayload } from '../webhooks/dto/ghl-webhook.dto';
import {
  FALLBACK_MESSAGE,
  INVALID_POSTCODE_RESPONSE,
  NO_APPOINTMENT_RESPONSE,
  POSTCODE_REGEX,
  BOOKING_KEYWORDS,
  RESCHEDULE_KEYWORDS,
  CANCEL_RESCHEDULE_KEYWORDS,
  OrchestratorMessage,
  OrchestratorContext,
  IntentResult,
} from './orchestrator.types';
import { PostcodeValidationService } from './postcode-validation.service';
import { normalisePostcode, buildSingleTurnPrompt, buildMultiTurnSystemPrompt } from './orchestrator.prompts';
import { handleNewLeadFlow } from './orchestrator.new-lead';
import { handleInboundMessageFlow } from './orchestrator.inbound-message';

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
    private readonly slotProvider: SlotProvider,
    private readonly appointmentsService: AppointmentsService,
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
      postcodeValidationService: this.postcodeValidationService,
      slotProvider: this.slotProvider,
      appointmentsService: this.appointmentsService,
      groqService: this.groqService,
    });
  }

  /**
   * Detects the intent of an inbound message based on its content and the current phase.
   * Phase-gating ensures each intent only fires in the appropriate conversation phase.
   */
  detectIntent(messageContent: string, currentPhase: string): IntentResult {
    if (currentPhase === 'qualifying') {
      const postcodeMatch = messageContent.match(POSTCODE_REGEX);
      if (postcodeMatch) {
        return { intent: 'PROVIDE_POSTCODE', data: { postcode: normalisePostcode(postcodeMatch[0]) } };
      }
      if (this.looksLikePostcodeAttempt(messageContent)) {
        return { intent: 'INVALID_POSTCODE_FORMAT' };
      }
    }

    if (currentPhase === 'qualified') {
      const lower = messageContent.toLowerCase();
      if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'WANT_TO_BOOK' };
      }
    }

    if (currentPhase === 'booked') {
      const lower = messageContent.toLowerCase();
      if (RESCHEDULE_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'RESCHEDULE' };
      }
    }

    if (currentPhase === 'rescheduling') {
      const lower = messageContent.toLowerCase();
      if (CANCEL_RESCHEDULE_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'CANCEL_RESCHEDULE' };
      }
    }

    return { intent: 'UNKNOWN' };
  }

  /**
   * Returns true when the whole message (stripped of whitespace) resembles a postcode
   * attempt: 3–9 alphanumeric characters only (digit requirement intentionally omitted
   * so random letter strings like "ghthhdh" are also caught).
   */
  private looksLikePostcodeAttempt(message: string): boolean {
    const stripped = message.replace(/\s+/g, '');
    return stripped.length >= 3 && stripped.length <= 9 && /^[A-Z0-9]+$/i.test(stripped);
  }

  /**
   * Generates an AI response based on the detected intent and conversation context.
   */
  async generateResponse(intent: IntentResult, context: OrchestratorContext, clinicConfig: ClinicConfig): Promise<string | null> {
    if (intent.intent === 'INVALID_POSTCODE_FORMAT') {
      return INVALID_POSTCODE_RESPONSE;
    }

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

    if (intent.intent === 'RESCHEDULE') {
      if (!context.currentAppointment) {
        return NO_APPOINTMENT_RESPONSE;
      }
      const { appointmentDate, appointmentTime } = context.currentAppointment;
      const rescheduleContext = `The patient wants to reschedule their appointment. Their current appointment is on ${appointmentDate} at ${appointmentTime}. Confirm the current appointment details and ask when they would prefer instead.`;
      return this.groqService.generateResponse(buildSingleTurnPrompt(rescheduleContext, context, clinicConfig));
    }

    if (intent.intent === 'CANCEL_RESCHEDULE') {
      const appt = context.currentAppointment;
      const apptDetail = appt ? ` on ${appt.appointmentDate} at ${appt.appointmentTime}` : '';
      const cancelContext = `The patient has decided to keep their existing appointment${apptDetail} and not reschedule. Confirm the appointment date and time explicitly and say you look forward to seeing them.`;
      return this.groqService.generateResponse(buildSingleTurnPrompt(cancelContext, context, clinicConfig));
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
