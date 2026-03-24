import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { Lead, LeadDocument } from '../database/schemas/lead.schema';
import { AbuseDetectionService } from './abuse-detection.service';

export interface AbuseHandleResult {
  reply: string;
  offeredSlots: [];
  slotSelection: null;
  bookingResult: null;
  abuseFlagged: true;
  /**
   * True when the lead has explicitly accepted the human offer.
   * The caller (ConversationsService) should pass this signal to the
   * US-20 escalation service — this service does not execute escalation itself.
   */
  escalationRequested: boolean;
}

/**
 * Handles abuse detection and response generation for US-19.
 * Kept separate from ConversationsService to respect the 200-line file limit.
 *
 * SCOPE: This service detects abuse and returns appropriate canned responses.
 * It does NOT execute escalation (phase changes, GHL tags, staff notifications)
 * as that is the responsibility of the US-20 escalation service.
 *
 * When escalationRequested is true in the returned result, the caller should
 * hand off to the US-20 escalation service.
 */
@Injectable()
export class AbuseHandlerService {
  private readonly logger = new Logger(AbuseHandlerService.name);

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly abuseDetectionService: AbuseDetectionService,
  ) {}

  /**
   * Runs abuse detection on an incoming lead message.
   * Returns null if the message is clean or only casual swearing — in which
   * case the normal AI flow should handle it.
   *
   * @param conversation - The current conversation document
   * @param clinic       - The clinic document (for message persistence)
   * @param lead         - The lead document (for message persistence)
   * @param userMessage  - The raw message text from the lead
   * @returns AbuseHandleResult with a canned response, or null if not abusive
   */
  async handle(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    userMessage: string,
  ): Promise<AbuseHandleResult | null> {
    const abuseResult = this.abuseDetectionService.check(
    userMessage,
    conversation.directedHostilityCount ?? 0,
    conversation.abuseOfferPending ?? false,
  );
  this.logger.log(`abuse check: offerPending=${conversation.abuseOfferPending}, 
    classification=${abuseResult.classification}, shouldEscalate=${abuseResult.shouldEscalate}`);

    // check escalation before classification check
    if (abuseResult.shouldEscalate) {
      return this.signalEscalation(conversation, clinic, lead, abuseResult.response!);
    }

    // Then check classification — if it's 'none' or 'casual', we can skip the abuse flow entirely
    if (abuseResult.classification === 'none' || abuseResult.classification === 'casual') {
      return null;
    }

    // Directed hostility — return canned redirect or repeat human offer
    return this.respondToHostility(conversation, clinic, lead, abuseResult);
  }

  /**
   * Saves the escalation confirmation message and returns escalationRequested: true.
   * Does NOT change the conversation phase or update GHL — that is US-20's job.
   */
  private async signalEscalation(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    confirmationMessage: string,
  ): Promise<AbuseHandleResult> {
    this.logger.warn(
      `Escalation requested via abuse flow — conversation: ${conversation._id}, ` +
      `lead: ${lead._id}. Handing off to US-20 escalation service.`,
    );

    // Clear the pending offer flag so it does not repeat after escalation
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      abuseOfferPending: false,
      lastMessageAt: new Date(),
      lastMessageFrom: 'ai',
      $inc: { messageCount: 1 },
    });

    await this.saveAiMessage(conversation, clinic, lead, confirmationMessage);

    return {
      reply: confirmationMessage,
      offeredSlots: [],
      slotSelection: null,
      bookingResult: null,
      abuseFlagged: true,
      escalationRequested: true,
    };
  }

  /**
   * Handles a directed-hostile message: persists the updated abuse state
   * and returns the appropriate canned response (calm redirect or human offer).
   */
  private async respondToHostility(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    abuseResult: ReturnType<AbuseDetectionService['check']>,
  ): Promise<AbuseHandleResult> {
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      directedHostilityCount: abuseResult.newDirectedCount,
      abuseOfferPending: abuseResult.offerIsPending,
      lastMessageAt: new Date(),
      lastMessageFrom: 'ai',
      $inc: { messageCount: 1 },
    });

    await this.saveAiMessage(conversation, clinic, lead, abuseResult.response!);

    return {
      reply: abuseResult.response!,
      offeredSlots: [],
      slotSelection: null,
      bookingResult: null,
      abuseFlagged: true,
      escalationRequested: false,
    };
  }

  /**
   * Saves an AI canned response to the messages collection.
   * @param conversation - The conversation to attach the message to
   * @param clinic       - The clinic the conversation belongs to
   * @param lead         - The lead the conversation belongs to
   * @param content      - The message content to save
   */
  private async saveAiMessage(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    content: string,
  ) {
    return this.messageModel.create({
      conversationId: conversation._id,
      clinicId: clinic._id,
      leadId: lead._id,
      sender: 'ai',
      content,
      channel: conversation.channel,
    });
  }
}