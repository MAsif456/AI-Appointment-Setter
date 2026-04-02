import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { WebhooksService, WebhookResponse } from "./webhooks.service";
import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { WebhookThrottleGuard } from "./guards/webhook-throttle.guard";
import { WebhookDedupInterceptor } from "./interceptors/webhook-dedup.interceptor";
import { WebhookExceptionFilter } from "./filters/webhook-exception.filter";
import { GhlWebhookValidatedDto } from "./dto/ghl-webhook.dto";

@Controller("webhooks")
@UseFilters(WebhookExceptionFilter)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post("ghl")
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard, WebhookThrottleGuard)
  @UseInterceptors(WebhookDedupInterceptor)
  @UsePipes(new ValidationPipe({ whitelist: false, transform: true }))
  async handleGhlWebhook(
    @Body() payload: GhlWebhookValidatedDto,
  ): Promise<WebhookResponse> {
    return this.webhooksService.handleGhlWebhook(payload);
  }
}
