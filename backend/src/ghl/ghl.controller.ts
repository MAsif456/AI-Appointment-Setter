import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SendMessageDto } from "./dto/send-message.dto";
import { GhlApiService } from "./ghl-api.service";

@Controller("ghl")
export class GhlController {
  private readonly logger = new Logger(GhlController.name);

  constructor(private readonly ghlApiService: GhlApiService) {}

  @Post("send")
  @HttpCode(HttpStatus.OK)
  /**
   * Sends a message to GHL API via sendMessageWithRetry.
   * @param {SendMessageDto} dto - The message to be sent.
   * @returns {Promise<{success: boolean, data: any}>} - The result of the message being sent.
   */
  async sendMessage(@Body() dto: SendMessageDto) {
    this.logger.log(
      `Sending ${dto.type} message to contactId: ${dto.contactId}`,
    );
    const result = await this.ghlApiService.sendMessageWithRetry(dto);
    return { success: true, data: result };
  }
}
