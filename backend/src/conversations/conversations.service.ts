import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { Lead, LeadDocument } from '../database/schemas/lead.schema';
import { ChatService, ChatMessage } from '../ai/chat.service';
import { SlotProvider } from '../ai/slot-provider';
import { Slot } from '../ai/interfaces/slot.interface';
import { selectSlots, selectLatestSlots, buildSlotPromptSection, formatSlotDisplay } from '../ai/slot-formatter';
import { buildContextFromDb } from './context-builder';
import { detectSlotSelection, SlotSelectionResult } from '../ai/slot-selector';

/** Day names indexed by Date.getDay() */
const DAYS_LOWER = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

/** Fetches slots and optionally filters by the lead's expressed preference. */
async function buildSlotContext(
  provider: SlotProvider,
  clinicId: string,
  urgency: 'urgent' | 'routine' | 'flexible',
  selectionResult: SlotSelectionResult | null,
): Promise<{ selected: Slot[]; slotSection: string }> {
  // When the lead requested a specific date range, pass it to the provider
  const requestedStart = selectionResult?.requestedStartDate
    ? new Date(selectionResult.requestedStartDate)
    : undefined;
  const requestedEnd = selectionResult?.requestedEndDate
    ? new Date(selectionResult.requestedEndDate)
    : undefined;

  const allSlots = await provider.getAvailableSlots(clinicId, requestedStart, requestedEnd);
  let slots: Slot[];

  if (selectionResult?.intent === 'FURTHER_DATE') {
    // Lead wants later/furthest dates — pick from the end of the range
    slots = selectLatestSlots(allSlots);
  } else if (selectionResult?.intent === 'DIFFERENT_DATE' && selectionResult.requestedDate) {
    // Lead asked for a specific day name — filter by that day
    const day = selectionResult.requestedDate.toLowerCase();
    slots = allSlots.filter(s => DAYS_LOWER[new Date(`${s.date}T${s.startTime}:00`).getDay()] === day);
    // Pick one slot per day, max 3
    const byDay = new Map<string, Slot>();
    for (const s of slots) {
      if (!byDay.has(s.date) && byDay.size < 3) byDay.set(s.date, s);
    }
    slots = Array.from(byDay.values());
  } else if (selectionResult?.intent === 'DIFFERENT_DATE' && selectionResult.requestedStartDate) {
    // Lead asked for a date range (e.g. "this week") — spread across the range
    slots = selectSlots(allSlots, urgency);
  } else if (selectionResult?.intent === 'DIFFERENT_TIME' && selectionResult.timePreference) {
    slots = allSlots.filter(s => {
      const hour = parseInt(s.startTime.split(':')[0], 10);
      if (selectionResult.timePreference === 'morning')   return hour < 12;
      if (selectionResult.timePreference === 'afternoon') return hour >= 12 && hour < 17;
      if (selectionResult.timePreference === 'evening')   return hour >= 17;
      return true; // 'earlier' / 'later' — let AI decide from all slots
    });
  } else {
    slots = selectSlots(allSlots, urgency);
  }

  return { selected: slots, slotSection: buildSlotPromptSection(slots, urgency) };
}

/**
 * Manages live conversations persisted in MongoDB.
 * Orchestrates the AI chat flow, slot offering, and slot-selection detection.
 */
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
   * @returns The greeting message content, or null on failure
   */
  async startConversation(conversationId: string): Promise<string | null> {
    const { conversation, clinic, lead } = await this.getConversation(conversationId);
    if (!clinic || !lead) throw new NotFoundException('Clinic or lead not found');
    const { leadInfo, clinicConfig } = buildContextFromDb(lead, clinic);
    const greeting = await this.chatService.startConversation(leadInfo, clinicConfig);
    if (!greeting) return null;
    await this.saveMessage(conversation, clinic, lead, 'ai', greeting);
    await this.updateConversationMeta(conversation, 'ai', 'greeting');
    return greeting;
  }

  /**
   * Processes a lead's message, runs slot-selection detection, and generates
   * an AI reply. Both messages are persisted to MongoDB.
   * @returns Object with the AI reply, offered slots, and selection result
   */
  async sendMessage(conversationId: string, userMessage: string) {
    const { conversation, messages, clinic, lead } = await this.getConversation(conversationId);
    if (!clinic || !lead) throw new NotFoundException('Clinic or lead not found');

    await this.saveMessage(conversation, clinic, lead, 'lead', userMessage);

    const history: ChatMessage[] = [
      ...messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const { leadInfo, clinicConfig } = buildContextFromDb(lead, clinic);
    const URGENCY_MAP: Record<string, 'urgent' | 'routine' | 'flexible'> = {
      urgent: 'urgent',
      routine: 'routine',
      unknown: 'flexible',
    };
    const urgency = URGENCY_MAP[lead.urgency] ?? 'flexible';

    // Detect what the lead meant if we have previously offered slots
    let selectionResult: SlotSelectionResult | null = null;
    if (conversation.offeredSlots?.length > 0) {
      try {
        selectionResult = detectSlotSelection(userMessage, conversation.offeredSlots);
      } catch (error) {
        this.logger.error('Slot detection failed, continuing without selection', error);
      }
    }

    // When the lead has selected a slot, keep the previously offered slots
    // instead of re-fetching — avoids the AI contradicting its earlier offer.
    let selected: Slot[];
    let slotSection: string;
    if (selectionResult?.intent === 'SLOT_SELECTED' && conversation.offeredSlots?.length > 0) {
      selected = conversation.offeredSlots.map((s: any) => {
        const dt = new Date(s.dateTime);
        return {
          date: dt.toISOString().split('T')[0],
          startTime: dt.toTimeString().substring(0, 5),
          endTime: '', // not needed for display
        };
      });
      slotSection = buildSlotPromptSection(selected, urgency);
    } else {
      ({ selected, slotSection } = await buildSlotContext(
        this.slotProvider, clinicConfig.clinicId, urgency, selectionResult,
      ));
    }

    const reply = await this.chatService.sendMessage(
      leadInfo, clinicConfig, history, userMessage,
      { slotOptions: { slotSection, selectionContext: selectionResult ?? undefined } },
    );
    if (!reply) return null;

    await this.storeOfferedSlots(conversation, selected);
    await this.saveMessage(conversation, clinic, lead, 'ai', reply);
    await this.updateConversationMeta(conversation, 'ai', undefined);

    const offeredSlots = selected.map(s => ({
      dateTime: new Date(`${s.date}T${s.startTime}:00`).toISOString(),
      displayText: formatSlotDisplay(s),
    }));
    return { reply, offeredSlots, slotSelection: selectionResult };
  }

  /** Resets a conversation by deleting all messages and resetting phase. */
  async resetConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.messageModel.deleteMany({ conversationId: conversation._id });
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      phase: 'greeting', messageCount: 0, offeredSlots: [],
      lastMessageAt: null, lastMessageFrom: null,
    });
  }

  /** Creates a message document in MongoDB */
  private async saveMessage(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    sender: 'ai' | 'lead',
    content: string,
  ) {
    return this.messageModel.create({
      conversationId: conversation._id,
      clinicId: clinic._id,
      leadId: lead._id,
      sender,
      content,
      channel: conversation.channel,
    });
  }

  /** Updates conversation metadata after a new message */
  private async updateConversationMeta(
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

  /** Persists the offered slots on the conversation for later selection matching. */
  private async storeOfferedSlots(conversation: ConversationDocument, slots: Slot[]) {
    if (slots.length === 0) return;
    const offeredSlots = slots.map(s => ({
      dateTime: new Date(`${s.date}T${s.startTime}:00`),
      displayText: formatSlotDisplay(s),
    }));
    await this.conversationModel.findByIdAndUpdate(conversation._id, { offeredSlots });
  }
}
