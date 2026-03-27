import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { FALLBACK_AI_UNAVAILABLE } from '../orchestrator/orchestrator.types';

/**
 * DTO for sending a message in an ongoing conversation.
 * Contains a single field for the message content.
 */
export interface SendMessageDto {
  /**
   * The message content to be sent.
   */
  message: string;
}


@Controller('conversations')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(private readonly conversationsService: ConversationsService) {}


  /**
   * Lists all conversations with basic lead/clinic info.
   * @returns Array of conversations
   */
  @Get()
  async list() {
    return this.conversationsService.listConversations();
  }

  /**
   * Retrieves a conversation with its messages and related clinic/lead data.
   * @param id - The conversation ID
   * @returns Conversation data with messages, clinic, and lead info
   */
  @Get(':id')
  async get(@Param('id') id: string) {
    const { conversation, messages, clinic, lead } =
      await this.conversationsService.getConversation(id);

    return {
      conversation,
      messages: messages.map((m) => ({
        id: m._id,
        sender: m.sender,
        content: m.content,
        timestamp: (m as any).createdAt,
      })),
      clinic: clinic
        ? { id: clinic._id, name: clinic.name, tone: clinic.aiConfig?.tone }
        : null,
      lead: lead
        ? {
            id: lead._id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            phone: lead.phone,
            email: lead.email,
            issue: lead.issue,
            postcode: lead.postcode,
            leadSource: lead.leadSource,
          }
        : null,
    };
  }


  /**
   * Starts a conversation with an AI greeting.
   * @param id - The conversation ID
   * @returns The AI greeting, or null on failure
   */
  @Post(':id/start')
  async start(@Param('id') id: string) {
    try {
      this.logger.log(`Starting conversation: ${id}`);
      const greeting = await this.conversationsService.startConversation(id);
      return { greeting };
    } catch (error) {
      this.logger.error(`Start conversation failed for ${id}:`, (error as Error).stack);
      return { greeting: FALLBACK_AI_UNAVAILABLE };
    }
  }


  /**
   * Resets a conversation by deleting all its messages and resetting the phase.
   * Allows re-testing the AI greeting with different clinic tone settings.
   * @param id - The conversation to reset
   * @returns Success status
   */
  @Post(':id/reset')
  async reset(@Param('id') id: string) {
    this.logger.log(`Resetting conversation: ${id}`);
    await this.conversationsService.resetConversation(id);
    return { success: true };
  }

  
  /**
   * Processes a lead's message and generates an AI reply.
   * Both messages are persisted to MongoDB.
   * @param id - The conversation ID
   * @param body - The lead's message content
   * @returns The AI reply, or null on failure
   */
  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() body: SendMessageDto,
  ) {
    try {
      this.logger.log(`Message in conversation ${id}: "${body.message}"`);
      const result = await this.conversationsService.sendMessage(id, body.message);
      if (!result) return { reply: FALLBACK_AI_UNAVAILABLE, offeredSlots: [], slotSelection: null, phase: null };

      // Include updated phase so the frontend can reflect changes immediately
      const { conversation } = await this.conversationsService.getConversation(id);
      return {
        reply: result.reply,
        offeredSlots: result.offeredSlots,
        slotSelection: result.slotSelection,
        phase: conversation.phase,
      };
    } catch (error) {
      this.logger.error(`Send message failed for conversation ${id}:`, (error as Error).stack);
      return { reply: FALLBACK_AI_UNAVAILABLE, offeredSlots: [], slotSelection: null, phase: null };
    }
  }
}

