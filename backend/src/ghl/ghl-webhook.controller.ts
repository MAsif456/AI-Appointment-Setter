import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { InboundWebhookDto } from "./dto/inbound-webhook.dto";
import { ConversationsService } from "./conversations.service";
import { MessagesService } from "./messages.service";
import { ClinicsService } from "../clinics/clinics.service";

@Controller("ghl/webhook")
export class GhlWebhookController {
  private readonly logger = new Logger(GhlWebhookController.name);

  /**
   * Constructor for GhlWebhookController.
   * @param conversationsService - The conversation service object.
   * @param messagesService - The message service object.
   * @param clinicsService - The clinics service object.
   */
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly clinicsService: ClinicsService,
  ) {}

  @Post("inbound")
  @HttpCode(HttpStatus.OK)
  /**
   * Handles an inbound webhook for a GHL contact.
   * @param payload - The InboundWebhookDto object containing the webhook payload.
   * @returns An object containing the success status, the updated conversation object, and the messages associated with the conversation.
   */
  async handleInbound(@Body() payload: InboundWebhookDto) {
    this.logger.log(
      `Inbound webhook received for contactId: ${payload.contactId}`,
    );

    const clinic = await this.clinicsService.findByGhlLocationId(
      payload.locationId,
    );

    const conversation = await this.conversationsService.findOrCreate(
      payload,
      clinic._id,
    );

    await this.messagesService.addMessage(
      conversation._id,
      clinic._id,
      conversation.leadId,
      "lead",
      payload.body,
      conversation.channel,
      payload.messageId,
    );

    const messages = await this.messagesService.getByConversation(
      conversation._id,
    );

    return {
      success: true,
      conversation: {
        id: conversation._id,
        phase: conversation.phase,
        channel: conversation.channel,
        ghlContactId: conversation.ghlContactId,
        messageCount: conversation.messageCount + 1,
        messages,
      },
    };
  }
}
