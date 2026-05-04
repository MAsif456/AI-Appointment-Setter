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
import { ClinicsService } from "../clinics/clinics.service";

@Controller("ghl")
export class GhlController {
  private readonly logger = new Logger(GhlController.name);

  constructor(
    private readonly ghlApiService: GhlApiService,
    private readonly clinicsService: ClinicsService,
  ) {}

  @Post("send")
  @HttpCode(HttpStatus.OK)
  /**
   * Sends a message to GHL API via sendMessageWithRetry.
   * Requires clinicId in the body to resolve the per-clinic API key.
   * @param {SendMessageDto} dto - The message to be sent.
   * @returns {Promise<{success: boolean, data: any}>} - The result of the message being sent.
   */
  async sendMessage(@Body() dto: SendMessageDto) {
    this.logger.log(`Sending ${dto.type} message to contactId: ${dto.contactId}`);
    let apiKey = '';
    if (dto.clinicId) {
      try {
        apiKey = await this.clinicsService.getDecryptedApiKey(dto.clinicId);
      } catch {
        this.logger.warn(`Could not resolve API key for clinicId: ${dto.clinicId}`);
      }
    }
    const result = await this.ghlApiService.sendMessageWithRetry(apiKey, dto);
    return { success: true, data: result };
  }
}
