import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Request } from "express";
import { WebhooksService, WebhookResponse } from "./webhooks.service";
import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { WebhookThrottleGuard } from "./guards/webhook-throttle.guard";
import { WebhookDedupInterceptor } from "./interceptors/webhook-dedup.interceptor";
import { WebhookExceptionFilter } from "./filters/webhook-exception.filter";
import { GhlWebhookValidatedDto } from "./dto/ghl-webhook.dto";

@Controller("webhooks")
@UseFilters(WebhookExceptionFilter)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post("ghl")
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard, WebhookThrottleGuard)
  @UseInterceptors(WebhookDedupInterceptor)
  @UsePipes(new ValidationPipe({ whitelist: false, transform: true }))
  async handleGhlWebhook(
    @Req() req: Request,
    @Body() payload: GhlWebhookValidatedDto,
  ): Promise<WebhookResponse> {
    // TODO: Remove after confirming GHL payload format
    this.logger.debug(`RAW GHL PAYLOAD: ${JSON.stringify(req.body)}`);
    return this.webhooksService.handleGhlWebhook(payload);
  }
}
