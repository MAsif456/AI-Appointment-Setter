/** Low-level MongoDB persistence for conversations: messages, metadata, slots, and date context. */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { Lead, LeadDocument } from '../database/schemas/lead.schema';
import { Slot } from '../ai/interfaces/slot.interface';
import { formatSlotDisplay } from '../ai/slot-formatter';
import { SlotSelectionResult } from '../ai/slot-selector';

@Injectable()
export class ConversationsPersistenceService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  /**
   * Creates a message document in MongoDB, optionally with urgency audit data.
   * @param conversation - The conversation the message belongs to.
   * @param clinic - The clinic associated with the conversation.
   * @param lead - The lead who sent or received the message.
   * @param sender - Whether the sender is the AI or the lead.
   * @param content - The message text.
   * @param urgencyData - Optional urgency level and score for audit logging.
   */
  async saveMessage(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    sender: 'ai' | 'lead',
    content: string,
    urgencyData?: { level: string; score: number },
  ) {
    const doc: Record<string, any> = {
      conversationId: conversation._id,
      clinicId: clinic._id,
      leadId: lead._id,
      sender,
      content,
      channel: conversation.channel,
    };
    if (urgencyData) {
      doc.extractedData = new Map([
        ['urgency', urgencyData.level],
        ['urgencyScore', urgencyData.score.toString()],
      ]);
    }
    return this.messageModel.create(doc);
  }

  /**
   * Updates conversation metadata after a new message is sent or received.
   * @param conversation - The conversation to update.
   * @param lastFrom - Who sent the last message ('ai' or 'lead').
   * @param phase - Optional new phase to transition to.
   */
  async updateConversationMeta(
    conversation: ConversationDocument,
    lastFrom: string,
    phase?: string,
  ) {
    const update: Record<string, any> = {
      lastMessageAt: new Date(),
      lastMessageFrom: lastFrom,
      $inc: { messageCount: 1 },
    };
    if (phase) update.phase = phase;
    await this.conversationModel.findByIdAndUpdate(conversation._id, update);
  }

  /**
   * Persists the offered slots on the conversation for later selection matching.
   * Also appends new slots to slotHistory (deduped) so the AI can reference
   * every slot it has ever offered in this conversation.
   * @param conversation - The conversation to update.
   * @param slots - The slots being offered in this turn.
   */
  async storeOfferedSlots(conversation: ConversationDocument, slots: Slot[]) {
    if (slots.length === 0) return;
    const offeredSlots = slots.map(s => ({
      dateTime: new Date(`${s.date}T${s.startTime}:00`),
      displayText: formatSlotDisplay(s),
    }));
    const existingHistory: { dateTime: Date; displayText: string }[] =
      (conversation.slotHistory as any[]) ?? [];
    const existingKeys = new Set(existingHistory.map(s => s.displayText));
    const newEntries = offeredSlots.filter(s => !existingKeys.has(s.displayText));
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      offeredSlots,
      slotHistory: [...existingHistory, ...newEntries],
    });
  }

  /**
   * Persists date-range context from the current slot selection onto the conversation,
   * so follow-up queries (e.g. "afternoon slots") can be scoped to the correct range.
   * @param conversation - The conversation to update.
   * @param selectionResult - The current slot selection result containing date context.
   */
  async saveDateContext(
    conversation: ConversationDocument,
    selectionResult: SlotSelectionResult | null,
  ): Promise<void> {
    const dateCtxUpdate: Record<string, any> = {};
    if (selectionResult?.requestedDate) {
      dateCtxUpdate.lastRequestedDay = selectionResult.requestedDate.toLowerCase();
    }
    if (selectionResult?.requestedStartDate) {
      dateCtxUpdate.lastRequestedDateStart = new Date(selectionResult.requestedStartDate);
      dateCtxUpdate.lastRequestedDateEnd = selectionResult.requestedEndDate
        ? new Date(selectionResult.requestedEndDate)
        : new Date(selectionResult.requestedStartDate);
    }
    if (Object.keys(dateCtxUpdate).length > 0) {
      await this.conversationModel.findByIdAndUpdate(conversation._id, dateCtxUpdate);
    }
  }
}
