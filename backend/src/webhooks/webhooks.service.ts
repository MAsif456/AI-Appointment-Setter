/**
 * Service responsible for processing incoming GoHighLevel (GHL) webhook payloads.
 *
 * Routes events to the correct clinic based on the location.id field in the payload.
 * Always resolves successfully — exceptions are caught and logged so that GHL never
 * receives a non-200 response, which would otherwise trigger unwanted retries.
 *
 * GHL payload field mapping (from GHL standard data):
 *   - Location ID: payload.location.id  (nested, not root-level)
 *   - Contact name: payload.first_name / payload.last_name  (snake_case)
 *   - Message content: payload.message.body  (nested)
 *   - Event type: payload.type  (custom key added in GHL Automation)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ClinicsService } from '../clinics/clinics.service';
import {
  GhlWebhookPayload,
  GhlContactCreatePayload,
  GhlInboundMessagePayload,
} from './dto/ghl-webhook.dto';

/** Response shape returned to GHL after processing any webhook event. */
export interface WebhookResponse {
  success: boolean;
}

/**
 * Handles all routing logic for GHL webhook events.
 * Depends on ClinicsService to resolve location.id → clinic document.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly clinicsService: ClinicsService) {}

  /**
   * Entry point for all incoming GHL webhook events.
   *
   * Processing steps:
   *   1. Log the full raw payload for debugging purposes.
   *   2. Extract location.id — warn and return early if absent.
   *   3. Look up the clinic by GHL Location ID.
   *   4. If clinic is not found, log and return 200 without processing.
   *   5. If clinic is inactive, log and return 200 without processing.
   *   6. Dispatch to the appropriate handler based on event type.
   *
   * The entire body is wrapped in try/catch so that any unexpected error
   * is logged and a 200 response is still returned to GHL.
   *
   * @param payload - The raw JSON request body sent by GHL.
   * @returns Always resolves to { success: true }.
   */
  async handleGhlWebhook(payload: Record<string, unknown>): Promise<WebhookResponse> {
    this.logger.log(`GHL webhook received: ${JSON.stringify(payload)}`);

    try {
      const ghlPayload = payload as GhlWebhookPayload;

      /** GHL sends the location ID nested under location.id, not at root level. */
      const locationId = ghlPayload.location?.id;
      const { type } = ghlPayload;

      if (!locationId) {
        this.logger.warn('GHL webhook payload missing locationId field');
        return { success: true };
      }

      const clinic = await this.clinicsService.findByGhlLocationId(locationId);

      if (!clinic) {
        this.logger.log(`Unknown GHL Location ID: ${locationId}`);
        return { success: true };
      }

      if (!clinic.isActive) {
        this.logger.log('Clinic is inactive, ignoring webhook');
        return { success: true };
      }

      switch (type) {
        case 'ContactCreate':
          this.handleContactCreate(payload as GhlContactCreatePayload, clinic.name);
          break;
        case 'InboundMessage':
          this.handleInboundMessage(payload as GhlInboundMessagePayload, clinic.name);
          break;
        default:
          this.logger.warn(`Unrecognised GHL event type: ${type}`);
      }
    } catch (err) {
      /** Log the error but still return 200 to prevent GHL retry storms. */
      this.logger.error(
        `Error processing GHL webhook: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    return { success: true };
  }

  /**
   * Handles a ContactCreate event.
   * Contact fields arrive at root level in snake_case format per GHL standard data.
   *
   * @param payload - The ContactCreate webhook payload from GHL.
   * @param clinicName - The name of the matched clinic, used in log output.
   */
  private handleContactCreate(
    payload: GhlContactCreatePayload,
    clinicName: string,
  ): void {
    const { first_name, last_name, phone, email, issue } = payload;
    this.logger.log(`Routing lead to clinic: ${clinicName}`);
    this.logger.log(
      `Lead details — name: ${first_name ?? ''} ${last_name ?? ''}, phone: ${phone ?? 'N/A'}, email: ${email ?? 'N/A'}, issue: ${issue ?? 'N/A'}`,
    );
    // TODO: persist lead document via LeadsService once implemented
  }

  /**
   * Handles an InboundMessage event.
   * Message content arrives nested under payload.message.body per GHL standard data.
   *
   * @param payload - The InboundMessage webhook payload from GHL.
   * @param clinicName - The name of the matched clinic, used in log output.
   */
  private handleInboundMessage(
    payload: GhlInboundMessagePayload,
    clinicName: string,
  ): void {
    const { id: contactId, conversationId } = payload;
    const messageBody = payload.message?.body;
    this.logger.log(`Routing message to clinic: ${clinicName}`);
    this.logger.log(
      `Message details — contactId: ${contactId ?? 'N/A'}, conversationId: ${conversationId ?? 'N/A'}, content: ${messageBody ?? 'N/A'}`,
    );
    // TODO: persist message document via ConversationsService once implemented
  }
}
