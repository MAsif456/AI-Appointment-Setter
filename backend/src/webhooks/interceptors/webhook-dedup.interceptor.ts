import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Observable, from, of } from "rxjs";
import { switchMap, tap } from "rxjs/operators";
import { createHash } from "crypto";
import {
  WebhookEvent,
  WebhookEventDocument,
} from "../schemas/webhook-event.schema";

@Injectable()
export class WebhookDedupInterceptor implements NestInterceptor {
  private readonly logger = new Logger(WebhookDedupInterceptor.name);

/**
 * Constructor for WebhookDedupInterceptor.
 * @param {Model<WebhookEventDocument>} webhookEventModel - Mongoose model for webhook events.
 */
  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly webhookEventModel: Model<WebhookEventDocument>,
  ) {}

/**
 * Intercepts incoming HTTP requests and applies the idempotency key pattern.
 * If the request includes an `Idempotency-Key` header:
 *  1. If the key has been seen before AND the payload hash matches,
 *     the cached response is returned without re-executing the handler.
 *  2. If the key has been seen but the payload differs, a 409 Conflict is thrown
 *     (prevents key reuse with different data).
 *  3. If the key is new, the handler executes and the result is cached.
 *
 * Requests without the header pass through unmodified.
 */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ body?: Record<string, unknown>; ip?: string }>();
    const body: Record<string, unknown> = request.body ?? {};
    const payloadHash = this.computeDedupKey(body);
    const startTime = Date.now();

    return from(this.webhookEventModel.findOne({ payloadHash })).pipe(
      switchMap((existing) => {
        if (existing && existing.disposition === "accepted") {
          this.logger.log(
            `Duplicate webhook detected — hash prefix: ${payloadHash.slice(0, 12)}, ` +
              `event type: ${typeof body.type === "string" ? body.type : "unknown"}`,
          );
          return of({ success: true });
        }

        return next.handle().pipe(
          tap(() => {
            void this.storeAcceptedEvent(
              payloadHash,
              body,
              request.ip,
              startTime,
            );
          }),
        );
      }),
    );
  }

  /**
   * Stores a webhook event in the database, marking it as accepted.
   * @param {string} payloadHash - SHA256 hash of the webhook event payload.
   * @param {Record<string, unknown>} body - Webhook event payload.
   * @param {string | undefined} ip - IP address of the webhook sender.
   * @param {number} startTime - Timestamp when the webhook event was received.
   */
  private async storeAcceptedEvent(
    payloadHash: string,
    body: Record<string, unknown>,
    ip: string | undefined,
    startTime: number,
  ): Promise<void> {
    try {
      await this.webhookEventModel.create({
        payloadHash,
        eventType: body.type as string | undefined,
        locationId: (body.location as Record<string, unknown> | undefined)
          ?.id as string | undefined,
        disposition: "accepted",
        ipAddress: ip,
        processingMs: Date.now() - startTime,
      });
    } catch (err: unknown) {
      const mongoErr = err as { code?: number; message?: string };
      if (mongoErr.code !== 11000) {
        this.logger.error(
          `Failed to store webhook event: ${mongoErr.message ?? "unknown error"}`,
        );
      }
    }
  }

  
  /**
   * Computes a deduplication key for the given webhook event payload.
   * If the payload contains a webhookDeliveryId field, it is used as the deduplication key,
   * prefixed with "ghl:". Otherwise, the SHA256 hash of the JSON stringified payload is used.
   * @param {Record<string, unknown>} body - Webhook event payload.
   * @returns {string} The deduplication key.
   * 
   * Ref: https://hookdeck.com/docs/deduplication
   */
  private computeDedupKey(body: Record<string, unknown>): string {
    if (body.webhookDeliveryId && typeof body.webhookDeliveryId === "string") {
      return `ghl:${body.webhookDeliveryId}`;
    }
    return createHash("sha256").update(JSON.stringify(body)).digest("hex");
  }
}
