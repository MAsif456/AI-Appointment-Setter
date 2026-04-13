/**
 * Service responsible for sending automated follow-up messages to unresponsive leads.
 *
 * Runs every hour via a cron job and processes eligible conversations:
 *   - First follow-up after 24 hours of no lead response (followUpCount 0 → 1)
 *   - Second follow-up after 48 hours of no lead response (followUpCount 1 → 2)
 *   - Close conversation after 7 days of no response (followUpCount ≥ 2)
 *
 * Follow-up messages are only sent within business hours (Mon–Fri, 9am–6pm UTC).
 * Closing a conversation happens regardless of business hours since no message is sent.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from '../database/schemas/conversation.schema';
import { Lead, LeadDocument } from '../database/schemas/lead.schema';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';

const FIRST_FOLLOW_UP_DELAY_MS = 24 * 60 * 60 * 1000;
const SECOND_FOLLOW_UP_DELAY_MS = 48 * 60 * 60 * 1000;
const CLOSE_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

const CHANNEL_TO_MESSAGE_TYPE: Record<string, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  facebook: 'FB',
  instagram: 'IG',
  website: 'Live_Chat',
};

/**
 * Returns true if the given time (UTC) is within business hours:
 * Monday–Friday, 09:00–17:59 UTC.
 *
 * Accepts an optional `now` parameter so tests can inject a fixed time
 * instead of always calling new Date().
 */
export function isWithinBusinessHours(now: Date = new Date()): boolean {
  const day = now.getUTCDay(); // 0 = Sun, 6 = Sat
  if (day === 0 || day === 6) return false;
  const hour = now.getUTCHours();
  return hour >= 9 && hour < 18;
}

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    private readonly messagesService: MessagesService,
    private readonly ghlApiService: GhlApiService,
  ) {}

  /**
   * Runs every hour. Finds all conversations overdue for a follow-up and
   * either sends a follow-up message or closes the conversation.
   *
   * Accepts an optional `now` parameter for testability — in production
   * the cron scheduler calls this with no arguments so it defaults to new Date().
   */
  @Cron('0 * * * *')
  async checkAndSendFollowUps(now: Date = new Date()): Promise<void> {
    const threshold24h = new Date(now.getTime() - FIRST_FOLLOW_UP_DELAY_MS);
    const threshold48h = new Date(now.getTime() - SECOND_FOLLOW_UP_DELAY_MS);
    const threshold7d = new Date(now.getTime() - CLOSE_DELAY_MS);

    let conversations: ConversationDocument[];
    try {
      conversations = await this.conversationModel
        .find({
          phase: { $in: ['qualifying', 'booking'] },
          lastMessageFrom: 'ai',
          $or: [
            { followUpCount: 0, lastMessageAt: { $lte: threshold24h } },
            { followUpCount: 1, lastMessageAt: { $lte: threshold48h } },
            { followUpCount: { $gte: 2 }, lastMessageAt: { $lte: threshold7d } },
          ],
        })
        .exec();
    } catch (err) {
      this.logger.error(
        `Follow-up job: failed to query conversations: ${(err as Error).message}`,
      );
      return;
    }

    let sent = 0;
    let closed = 0;

    for (const conversation of conversations) {
      try {
        const result = await this.processConversation(conversation, now);
        if (result === 'sent') sent++;
        else if (result === 'closed') closed++;
      } catch (err) {
        this.logger.error(
          `Follow-up job: error processing conversation ${conversation._id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Follow-up job complete — checked: ${conversations.length}, sent: ${sent}, closed: ${closed}`,
    );
  }

  private async processConversation(
    conversation: ConversationDocument,
    now: Date,
  ): Promise<'sent' | 'closed' | 'skipped'> {
    const { followUpCount } = conversation;

    // Close conversation (no message sent, business hours not required)
    if (followUpCount >= 2) {
      return this.closeConversation(conversation, now);
    }

    // Follow-up messages respect business hours
    if (!isWithinBusinessHours(now)) {
      return 'skipped';
    }

    const lead = await this.leadModel.findById(conversation.leadId).exec();
    const firstName = (lead as (LeadDocument & { firstName?: string }) | null)?.firstName ?? 'there';
    const contactId = conversation.ghlContactId ?? '';
    const messageType = CHANNEL_TO_MESSAGE_TYPE[conversation.channel] ?? 'SMS';

    const message =
      followUpCount === 0
        ? `Hi ${firstName}, just checking in! Still interested in booking?`
        : `Hey ${firstName}, I don't want to keep bothering you! Let me know if I can help.`;

    const sendResult = await this.ghlApiService.sendMessageWithRetry({
      type: messageType,
      contactId,
      message,
    });

    await this.messagesService.addMessage(
      conversation._id as Types.ObjectId,
      conversation.clinicId as Types.ObjectId,
      conversation.leadId as Types.ObjectId,
      'ai',
      message,
      conversation.channel,
      sendResult?.id ?? sendResult?.messageId,
    );

    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      $inc: { followUpCount: 1 },
      lastFollowUpAt: now,
    });

    return 'sent';
  }

  private async closeConversation(
    conversation: ConversationDocument,
    now: Date,
  ): Promise<'closed'> {
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      phase: 'closed',
      closedAt: now,
      closedReason: 'no_response',
    });

    const contactId = conversation.ghlContactId ?? '';
    const tagResult = await this.ghlApiService.addContactTag(contactId, 'unresponsive');
    if (tagResult === null) {
      this.logger.warn(
        `Could not add "unresponsive" tag for contact ${contactId}`,
      );
    }

    return 'closed';
  }
}
