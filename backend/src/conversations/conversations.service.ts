import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { Lead, LeadDocument } from '../database/schemas/lead.schema';
import { ChatService, ChatMessage } from '../ai/chat.service';
import { LeadInfo } from '../ai/interfaces/lead-info.interface';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';

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

    const { leadInfo, clinicConfig } = this.buildContextFromDb(lead, clinic);

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
   * @returns The AI reply, or null on failure
   */
  async sendMessage(conversationId: string, userMessage: string): Promise<string | null> {
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

    const { leadInfo, clinicConfig } = this.buildContextFromDb(lead, clinic);

    const reply = await this.chatService.sendMessage(leadInfo, clinicConfig, history, userMessage);
    if (!reply) return null;

    // Save the AI reply
    await this.saveMessage(conversation, clinic, lead, 'ai', reply);
    await this.updateConversationMeta(conversation, 'ai', undefined);

    return reply;
  }

  /**
   * Resets a conversation by deleting all its messages and resetting the phase.
   * Allows re-testing the AI greeting with different clinic tone settings.
   * @param conversationId - The conversation to reset
   */
  async resetConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    await this.messageModel.deleteMany({ conversationId: conversation._id });
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      phase: 'greeting',
      messageCount: 0,
      lastMessageAt: null,
      lastMessageFrom: null,
    });

    this.logger.log(`Conversation ${conversationId} reset`);
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

  /** Converts MongoDB Clinic + Lead documents into the AI service interfaces */
  private buildContextFromDb(lead: LeadDocument, clinic: ClinicDocument) {
    const leadInfo: LeadInfo = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      issue: lead.issue,
      leadSource: lead.leadSource,
    };

    const tone = clinic.aiConfig?.tone === 'professional' ? 'Professional' : 'Friendly';
    const clinicConfig: ClinicConfig = {
      clinicId: (clinic._id as Types.ObjectId).toString(),
      name: clinic.name,
      tone,
      greetingTemplate: clinic.aiConfig?.greetingTemplate || undefined,
      serviceAreas: clinic.serviceAreas?.map((sa) => sa.postcodePrefix) || [],
      customInstructions: clinic.aiConfig?.customInstructions || undefined,
      ghlLocationId: clinic.ghlLocationId,
      isActive: clinic.isActive,
    };

    return { leadInfo, clinicConfig };
  }
}
