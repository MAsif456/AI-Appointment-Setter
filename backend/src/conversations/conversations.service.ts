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
import { selectSlots, buildSlotPromptSection, formatSlotDisplay } from '../ai/slot-formatter';
import { buildContextFromDb } from './context-builder';

/**
 * Manages live conversations persisted in MongoDB.
 * Orchestrates the AI chat flow and stores messages.
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

  /**
   * Retrieves a conversation with its messages and related clinic/lead data.
   * @param conversationId - The MongoDB _id of the conversation
   * @returns Conversation data with messages, clinic, and lead info
   */
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

  /**
   * Lists all conversations with basic lead/clinic info.
   * @returns Array of conversations
   */
  async listConversations() {
    return this.conversationModel
      .find()
      .populate('clinicId', 'name')
      .populate('leadId', 'firstName lastName phone')
      .sort({ lastMessageAt: -1 });
  }

  /**
   * Generates the AI greeting for a conversation and saves it as the first message.
   * @param conversationId - The conversation to start
   * @returns The greeting message content, or null on failure
   */
  async startConversation(conversationId: string): Promise<string | null> {
    const { conversation, clinic, lead } = await this.getConversation(conversationId);
    if (!clinic || !lead) throw new NotFoundException('Clinic or lead not found');

    const { leadInfo, clinicConfig } = buildContextFromDb(lead, clinic);

    const greeting = await this.chatService.startConversation(leadInfo, clinicConfig);
    if (!greeting) return null;

    // Save the AI greeting as a message
    await this.saveMessage(conversation, clinic, lead, 'ai', greeting);
    await this.updateConversationMeta(conversation, 'ai', 'greeting');

    return greeting;
  }

  /**
   * Processes a lead's message and generates an AI reply.
   * Both messages are persisted to MongoDB.
   * @param conversationId - The conversation ID
   * @param userMessage - The lead's message text
   * @returns Object with the AI reply and offered slots, or null on failure
   */
  async sendMessage(conversationId: string, userMessage: string) {
    const { conversation, messages, clinic, lead } = await this.getConversation(conversationId);
    if (!clinic || !lead) throw new NotFoundException('Clinic or lead not found');

    // Save the user's message first
    await this.saveMessage(conversation, clinic, lead, 'lead', userMessage);

    // Build history from existing messages + new user message
    const history: ChatMessage[] = messages.map((m) => ({
      role: m.sender === 'ai' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }));
    history.push({ role: 'user', content: userMessage });

    const { leadInfo, clinicConfig } = buildContextFromDb(lead, clinic);

    // Fetch available slots and build prompt context
    const allSlots = await this.slotProvider.getAvailableSlots(clinicConfig.clinicId);
    const urgency = (lead.urgency as 'urgent' | 'routine' | 'flexible') || 'flexible';
    const selected = selectSlots(allSlots, urgency);
    const slotSection = buildSlotPromptSection(selected, urgency);

    const reply = await this.chatService.sendMessage(
      leadInfo, clinicConfig, history, userMessage,
      { slotOptions: { slotSection } },
    );
    if (!reply) return null;

    // Store offered slots on conversation for later matching
    await this.storeOfferedSlots(conversation, selected);

    // Save the AI reply
    await this.saveMessage(conversation, clinic, lead, 'ai', reply);
    await this.updateConversationMeta(conversation, 'ai', undefined);

    // Return reply with offered slots for real-time sidebar updates
    const offeredSlots = selected.map((s) => ({
      dateTime: new Date(`${s.date}T${s.startTime}:00`).toISOString(),
      displayText: formatSlotDisplay(s),
    }));

    return { reply, offeredSlots };
  }

  /**
   * Resets a conversation by deleting all messages and resetting the phase.
   * Allows re-testing the AI greeting with different settings.
   * @param conversationId - The conversation to reset
   */
  async resetConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    await this.messageModel.deleteMany({ conversationId: conversation._id });
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      phase: 'greeting',
      messageCount: 0,
      offeredSlots: [],
      lastMessageAt: null,
      lastMessageFrom: null,
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

  /**
   * Persists the offered slots on the conversation document.
   * Stores full datetime and display text for later selection matching.
   */
  private async storeOfferedSlots(
    conversation: ConversationDocument,
    slots: Slot[],
  ) {
    if (slots.length === 0) return;

    const offeredSlots = slots.map((s) => ({
      dateTime: new Date(`${s.date}T${s.startTime}:00`),
      displayText: formatSlotDisplay(s),
    }));

    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      offeredSlots,
    });
  }

}
