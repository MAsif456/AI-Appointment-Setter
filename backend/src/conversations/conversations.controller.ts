import { Controller, Get, Post, Param, Body, Logger, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { FALLBACK_AI_UNAVAILABLE } from '../orchestrator/orchestrator.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SensitiveData } from '../security-headers/sensitive-data.decorator';

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


/*
 * Every handler on this controller returns lead PII (names, phone, email,
 * postcode, message history) or triggers AI responses tied to a specific
 * lead. Marking the whole class with @SensitiveData() guarantees the
 * CacheControlInterceptor stamps no-store headers on every response,
 * including new handlers added later.
 */
@SensitiveData()
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(private readonly conversationsService: ConversationsService) {}


  /**
   * Lists all conversations with basic lead/clinic info.
   * @returns Array of conversations
   */
  @Get()
  async list(@Request() req: any) {
    const user = req.user; // { _id, email, role, assignedClinics }

    // If admin → return all conversations
    if (user.role === 'admin') {
      return this.conversationsService.listConversations();
    }
    
    // If staff → filter by assignedClinics
    const clinicIds = user.assignedClinics || [];
    return this.conversationsService.listConversations(clinicIds);
  }

  /**
   * Retrieves a conversation with its messages and related clinic/lead data.
   * @param id - The conversation ID
   * @returns Conversation data with messages, clinic, and lead info
   */
  @Get(':id')
  async get(@Param('id') id: string, @Request() req: any) {
    const { conversation, messages, clinic, lead } =
      await this.conversationsService.getConversation(id);

      // Verify user has access to this conversation's clinic
      const user = req.user;
      if (user.role === 'staff') {
        const clinicId = conversation.clinicId.toString();
        const assignedClinicIds = user.assignedClinics.map((id: any) => id.toString());
        
        if (!assignedClinicIds.includes(clinicId)) {
          throw new ForbiddenException('You do not have access to this conversation');
        }
      }
      // Admins can view all conversations (no check needed)

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
  async start(@Param('id') id: string, @Request() req: any) {
    try {
      // check if user has access to this conversation's clinic before starting
      const { conversation } = await this.conversationsService.getConversation(id);
      const user = req.user;
      if (user.role === 'staff') {
        const clinicId = conversation.clinicId.toString();
        const assignedClinicIds = user.assignedClinics.map((id: any) => id.toString());
        if (!assignedClinicIds.includes(clinicId)) {
          throw new ForbiddenException('You do not have access to this conversation');
        }
      }
      this.logger.log(`Starting conversation: ${id}`);
      const greeting = await this.conversationsService.startConversation(id);
      if (!greeting || greeting === null || greeting === undefined) {
        return { greeting: FALLBACK_AI_UNAVAILABLE };
      }
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
  async reset(@Param('id') id: string, @Request() req: any) {

    // Check authorization
    const { conversation } = await this.conversationsService.getConversation(id);
    const user = req.user;
    if (user.role === 'staff') {
      const clinicId = conversation.clinicId.toString();
      const assignedClinicIds = user.assignedClinics.map((id: any) => id.toString());
      if (!assignedClinicIds.includes(clinicId)) {
        throw new ForbiddenException('You do not have access to this conversation');
      }
    }

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
    @Request() req: any
  ) {
    try {

      // ✅ Check authorization
      const { conversation } = await this.conversationsService.getConversation(id);
      const user = req.user;
      if (user.role === 'staff') {
        const clinicId = conversation.clinicId.toString();
        const assignedClinicIds = user.assignedClinics.map((id: any) => id.toString());
        if (!assignedClinicIds.includes(clinicId)) {
          throw new ForbiddenException('You do not have access to this conversation');
        }
      }

      this.logger.log(`Message in conversation ${id}: "${body.message}"`);
      const result = await this.conversationsService.sendMessage(id, body.message);
      if (!result) return { reply: FALLBACK_AI_UNAVAILABLE, offeredSlots: [], slotSelection: null, bookingResult: null, phase: null };

      // Include updated phase so the frontend can reflect changes immediately
      const { conversation: updatedConversation } = await this.conversationsService.getConversation(id);

      return {
        reply: result.reply,
        offeredSlots: result.offeredSlots,
        slotSelection: result.slotSelection,
        bookingResult: result.bookingResult ?? null,
        phase: updatedConversation.phase,
      };
    } catch (error) {
      this.logger.error(`Send message failed for conversation ${id}:`, (error as Error).stack);
      return { reply: FALLBACK_AI_UNAVAILABLE, offeredSlots: [], slotSelection: null, bookingResult: null, phase: null };
    }
  }
}

