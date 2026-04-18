import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { WebhooksService, WebhookResponse } from "./webhooks.service";
import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { WebhookThrottleGuard } from "./guards/webhook-throttle.guard";
import { WebhookDedupInterceptor } from "./interceptors/webhook-dedup.interceptor";
import { WebhookExceptionFilter } from "./filters/webhook-exception.filter";

@Controller("webhooks")
@UseFilters(WebhookExceptionFilter)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Accepts raw GHL webhook payloads without DTO validation.
   *
   * GHL workflow webhooks nest custom keys under `customData` and use
   * field names like `contact_id` and `Issue` that don't match a strict DTO.
   * The WebhooksService normalises the payload before processing.
   */
  @Post("ghl")
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard, WebhookThrottleGuard)
  @UseInterceptors(WebhookDedupInterceptor)
  async handleGhlWebhook(
    @Body() payload: Record<string, unknown>,
  ): Promise<WebhookResponse> {
    return this.webhooksService.handleGhlWebhook(payload);
  }
}
