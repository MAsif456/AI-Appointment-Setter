/**
 * Controller exposing the GoHighLevel (GHL) webhook endpoint.
 *
 * This controller is intentionally thin — all routing logic lives in WebhooksService.
 * The sole responsibility here is to accept the HTTP request and always respond with
 * HTTP 200, which prevents GHL from treating a successful delivery as a failure and
 * retrying the event.
 */
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { WebhooksService, WebhookResponse } from './webhooks.service';

/**
 * Handles all inbound webhook traffic from GoHighLevel.
 * All routes are prefixed with /webhooks.
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * POST /webhooks/ghl
   *
   * Accepts any JSON payload sent by GoHighLevel and delegates processing
   * to WebhooksService. The @HttpCode(200) decorator is required because
   * NestJS defaults POST responses to 201 (Created).
   *
   * @param payload - The raw JSON body sent by GHL; shape varies by event type.
   * @returns { success: true } with HTTP 200 regardless of processing outcome.
   */
  @Post('ghl')
  @HttpCode(200)
  async handleGhlWebhook(
    @Body() payload: Record<string, unknown>,
  ): Promise<WebhookResponse> {
    return this.webhooksService.handleGhlWebhook(payload);
  }
}
