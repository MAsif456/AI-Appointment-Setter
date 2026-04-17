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
import { Injectable, Logger } from "@nestjs/common";
import { GroqService } from "../ai/groq.service";
import { GreetingService } from "../ai/greeting.service";
import { SlotProvider } from "../ai/slot-provider";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { CancellationService } from "../cancellation/cancellation.service";
import { ConversationsService } from "../ghl/conversations.service";
import { MessagesService } from "../ghl/messages.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { AppointmentsService } from "../appointments/appointments.service";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { ConversationsService as ChatConversationsService } from "../conversations/conversations.service";
import {
  GhlContactCreatePayload,
  GhlInboundMessagePayload,
} from "../webhooks/dto/ghl-webhook.dto";
import {
  FALLBACK_MESSAGE,
  OrchestratorMessage,
  OrchestratorContext,
  IntentResult,
} from "./orchestrator.types";
import { PostcodeValidationService } from "./postcode-validation.service";
import { handleNewLeadFlow } from "./orchestrator.new-lead";
import { handleInboundMessageFlow } from "./orchestrator.inbound-message";
import { generateOrchestratorResponse } from "./orchestrator.generate-response";
import { detectOrchestratorIntent } from "./orchestrator.detect-intent";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { ConsentService } from "../gdpr/consent/consent.service";

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
    private readonly postcodeValidationService: PostcodeValidationService,
    private readonly slotProvider: SlotProvider,
    private readonly appointmentsService: AppointmentsService,
    private readonly securityPipeline: SecurityPipelineService,
    private readonly patientHistoryService: PatientHistoryService,
    private readonly chatConversationsService: ChatConversationsService,
    private readonly consentService: ConsentService,
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
      patientHistoryService: this.patientHistoryService,
      securityPipeline: this.securityPipeline,
      consentService: this.consentService,
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
      ghlApiService: this.ghlApiService,
      logger: this.logger,
      correlationId,
      chatConversationsService: this.chatConversationsService,
      patientHistoryService: this.patientHistoryService,
    });
  }

  /** Delegates to detectOrchestratorIntent — kept as a method so it can be bound and tested. */
  detectIntent(
    messageContent: string,
    currentPhase: string,
    context?: Pick<OrchestratorContext, "isReturningPatient">,
  ): IntentResult {
    return detectOrchestratorIntent(messageContent, currentPhase, context);
  }

  /**
   * Generates an AI response based on the detected intent and conversation context.
   * Delegates to generateOrchestratorResponse — kept here so the method is injectable/testable.
   */
  async generateResponse(
    intent: IntentResult,
    context: OrchestratorContext,
    clinicConfig: ClinicConfig,
  ): Promise<string | null> {
    return generateOrchestratorResponse(
      intent,
      context,
      clinicConfig,
      this.groqService,
      this.cancellationService,
    );
  }

  /** Creates a structured message object representing a conversation turn. */
  createMessage(
    content: string,
    role: "user" | "assistant",
  ): OrchestratorMessage {
    return { content, role, timestamp: new Date() };
  }
}
