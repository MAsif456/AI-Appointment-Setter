/** Manages live conversations: AI chat flow, slot offering, slot-selection, and auto-booking (US-15). */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { Lead, LeadDocument } from '../database/schemas/lead.schema';
import { ChatService, ChatMessage } from '../ai/chat.service';
import { SlotProvider } from '../ai/slot-provider';
import { buildContextFromDb } from './context-builder';
import { SlotSelectionResult } from '../ai/slot-selector';
import { AppointmentsService, BookingResult } from '../appointments/appointments.service';
import { UrgencyLevel } from '../ai/urgency-detector.types';
import { UrgencyPipeline } from '../ai/urgency-pipeline';
import { EscalationService } from '../ai/escalation.service';
import { PATIENT_EMERGENCY_FOLLOWUP } from '../ai/urgency-messages';
import { AbuseHandlerService } from './abuse-handler.service';
import { SecurityPipelineService } from '../security/security-pipeline.service';
import { FALLBACK_AI_UNAVAILABLE } from '../orchestrator/orchestrator.types';
import { CancellationService } from '../cancellation/cancellation.service';
import { ConversationsPersistenceService } from './conversations.persistence.service';
import { resolveSlotSelectionIntent } from './slot-selection.resolver';
import { handleBooking } from './conversations.booking.handler';
import { handleCancellationIntercept } from './conversations.cancellation.handler';
import { handleDayOverview, buildAndSendReply } from './conversations.reply.handler';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Clinic.name) private clinicModel: Model<ClinicDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private readonly chatService: ChatService,
    private readonly slotProvider: SlotProvider,
    private readonly appointmentsService: AppointmentsService,
    private readonly urgencyPipeline: UrgencyPipeline,
    private readonly escalationService: EscalationService,
    private readonly abuseHandler: AbuseHandlerService,
    private readonly securityPipeline: SecurityPipelineService,
    private readonly cancellationService: CancellationService,
    private readonly persistence: ConversationsPersistenceService,
  ) {}

  /** Retrieves a conversation with its messages and related clinic/lead data. */
  async getConversation(conversationId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    const [messages, clinic, lead] = await Promise.all([
      this.messageModel.find({ conversationId: conversation._id }).sort({ createdAt: 1 }),
      this.clinicModel.findById(conversation.clinicId),
      this.leadModel.findById(conversation.leadId),
    ]);
    return { conversation, messages, clinic, lead };
  }

  /** Lists all conversations with basic lead/clinic info. */
  async listConversations() {
    return this.conversationModel
      .find()
      .populate('clinicId', 'name')
      .populate('leadId', 'firstName lastName phone')
      .sort({ lastMessageAt: -1 });
  }

  /**
   * Generates the AI greeting for a conversation and saves it as the first message.
   * @returns The greeting message content, or null on failure.
   */
  async startConversation(conversationId: string): Promise<string | null> {
    const { conversation, clinic, lead } = await this.getConversation(conversationId);
    if (!clinic || !lead) throw new NotFoundException('Clinic or lead not found');

    if (lead.issue && lead.urgency === 'unknown') {
      const { resolved } = this.urgencyPipeline.assessFormData(lead.issue);
      if (resolved !== 'routine') {
        await this.leadModel.findByIdAndUpdate(lead._id, { urgency: resolved });
        (lead as any).urgency = resolved;
      }
    }

    const { leadInfo, clinicConfig } = buildContextFromDb(lead, clinic);
    const greeting = await this.chatService.startConversation(leadInfo, clinicConfig);
    const finalGreeting = greeting ?? FALLBACK_AI_UNAVAILABLE;
    if (!greeting) this.logger.warn('Greeting generation failed — using fallback');
    await this.persistence.saveMessage(conversation, clinic, lead, 'ai', finalGreeting);
    await this.persistence.updateConversationMeta(conversation, 'ai', 'greeting');
    return finalGreeting;
  }

  /**
   * Processes a lead's message, runs slot-selection detection, and generates
   * an AI reply. When the lead confirms a slot (SLOT_SELECTED), the appointment
   * is automatically booked via AppointmentsService. Both messages are persisted.
   * @returns Object with the AI reply, offered slots, selection result, and booking result.
   */
  async sendMessage(conversationId: string, userMessage: string) {
    const { conversation, messages, clinic, lead } = await this.getConversation(conversationId);
    if (!clinic || !lead) throw new NotFoundException('Clinic or lead not found');

    const { resolved: resolvedUrgency, assessment: urgencyAssessment } =
      await this.urgencyPipeline.assessMessage(
        userMessage,
        (lead.urgency as UrgencyLevel | 'unknown') ?? 'unknown',
        lead.issue,
      );

    await this.persistence.saveMessage(conversation, clinic, lead, 'lead', userMessage, {
      level: urgencyAssessment.level, score: urgencyAssessment.score,
    });
    await this.persistence.saveMessage(conversation, clinic, lead, 'lead', userMessage);

    const abuseHandled = await this.abuseHandler.handle(conversation, clinic, lead, userMessage);
    if (abuseHandled) return abuseHandled;

    // Security pipeline: sanitise input, detect injection, enforce boundaries
    const securityResult = await this.securityPipeline.processInbound(
      userMessage,
      conversationId,
      (conversation.clinicId as any).toString(),
      conversation.phase,
      (conversation.leadId as any).toString(),
    );
    if (!securityResult.allowed) {
      const fallback = securityResult.fallbackResponse ?? "I'm here to help you book an appointment. How can I assist?";
      await this.persistence.saveMessage(conversation, clinic, lead, 'ai', fallback);
      await this.persistence.updateConversationMeta(conversation, 'ai', undefined);
      return { reply: fallback, offeredSlots: [], slotSelection: null, bookingResult: null };
    }

    const cancelResult = await handleCancellationIntercept(
      conversation, clinic, lead, userMessage,
      this.cancellationService,
      (sender, content, urgencyData) => this.persistence.saveMessage(conversation, clinic, lead, sender, content, urgencyData),
      (lastFrom, phase) => this.persistence.updateConversationMeta(conversation, lastFrom, phase),
    );
    if (cancelResult) return cancelResult;

    const history: ChatMessage[] = [
      ...messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];
    const { leadInfo, clinicConfig } = buildContextFromDb(lead, clinic);

    if (resolvedUrgency !== lead.urgency) {
      await this.leadModel.findByIdAndUpdate(lead._id, { urgency: resolvedUrgency });
      this.escalationService.updateGhlTags(lead, resolvedUrgency).catch(
        err => this.logger.warn(`GHL tag update failed: ${err.message}`),
      );
    }

    if (resolvedUrgency === 'emergency') {
      // Already escalated — send a softer follow-up to avoid repeating the full escalation message
      if (conversation.phase === 'escalated') {
        await this.persistence.saveMessage(conversation, clinic, lead, 'ai', PATIENT_EMERGENCY_FOLLOWUP);
        await this.persistence.updateConversationMeta(conversation, 'ai', undefined);
        return { reply: PATIENT_EMERGENCY_FOLLOWUP, offeredSlots: [], slotSelection: null, bookingResult: null };
      }
      const escalation = await this.escalationService.escalateEmergency(conversation, lead, clinic, urgencyAssessment);
      await this.persistence.saveMessage(conversation, clinic, lead, 'ai', escalation.aiMessage);
      await this.persistence.updateConversationMeta(conversation, 'ai', 'escalated');
      return { reply: escalation.aiMessage, offeredSlots: [], slotSelection: null, bookingResult: null };
    }

    const urgency: 'urgent' | 'routine' | 'flexible' =
      resolvedUrgency === 'urgent' ? 'urgent' : resolvedUrgency === 'routine' ? 'routine' : 'flexible';

    const selectionResult = await resolveSlotSelectionIntent(
      conversation, userMessage, this.conversationModel, this.logger,
    );

    let bookingResult: BookingResult | null = null;
    if (selectionResult?.intent === 'SLOT_SELECTED' && selectionResult.selectedSlot) {
      bookingResult = await handleBooking(
        conversation, clinic, lead, selectionResult, this.appointmentsService, this.logger,
      );
    }

    const replyDeps = {
      slotProvider: this.slotProvider,
      chatService: this.chatService,
      escalationService: this.escalationService,
      persistence: this.persistence,
      conversationModel: this.conversationModel,
    };

    if (selectionResult?.intent === 'DAY_OVERVIEW') {
      return handleDayOverview(
        conversation, clinic, lead, history, userMessage, selectionResult as SlotSelectionResult,
        clinicConfig, leadInfo, replyDeps,
      );
    }

    return buildAndSendReply(
      conversation, clinic, lead, history, userMessage, selectionResult,
      urgency, bookingResult, clinicConfig, leadInfo, replyDeps,
    );
  }

  /** Resets a conversation by deleting all messages and resetting phase. */
  async resetConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.messageModel.deleteMany({ conversationId: conversation._id });
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      phase: 'greeting', messageCount: 0, offeredSlots: [], slotHistory: [],
      directedHostilityCount: 0, abuseOfferPending: false,
      lastMessageAt: null, lastMessageFrom: null, awaitingDaySelection: false,
      lastRequestedDay: null, lastRequestedDateStart: null, lastRequestedDateEnd: null,
    });
    await this.leadModel.findByIdAndUpdate(conversation.leadId, { urgency: 'unknown' });
  }
}
