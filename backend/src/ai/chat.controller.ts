import { Controller, Post, Body, Logger } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { StartChatDto } from "./dto/start-chat.dto";
import { SendMessageDto } from "./dto/send-message.dto";

/**
 * REST controller for the live AI chat feature.
 * Exposes endpoints to start conversations and send messages.
 *
 * Both endpoints accept validated DTOs (see ./dto/*) so the global
 * ValidationPipe can reject oversized messages, NoSQL operator objects
 * smuggled into nested fields, and any property outside the declared
 * schema before the request reaches the LLM or persistence layer.
 */
@Controller("chat")
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Starts a new conversation and returns the AI greeting.
   * POST /chat/start
   */
  @Post("start")
  async startChat(
    @Body() body: StartChatDto,
  ): Promise<{ greeting: string | null }> {
    this.logger.log(
      `Starting chat for lead: ${body.leadInfo.firstName} at ${body.clinicConfig.name}`,
    );

    const greeting = await this.chatService.startConversation(
      body.leadInfo,
      body.clinicConfig,
    );

    return { greeting };
  }

  /**
   * Sends a message from the lead and returns the AI response.
   * POST /chat/message
   */
  @Post("message")
  async sendMessage(
    @Body() body: SendMessageDto,
  ): Promise<{ reply: string | null }> {
    this.logger.log(
      `Message from ${body.leadInfo.firstName}: "${body.message}"`,
    );

    const reply = await this.chatService.sendMessage(
      body.leadInfo,
      body.clinicConfig,
      body.history,
      body.message,
    );

    return { reply };
  }
}
