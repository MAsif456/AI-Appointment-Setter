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
   *
   * Uses an atomic findOneAndUpdate with $setOnInsert to eliminate the TOCTOU
   * (time-of-check-to-time-of-use) race condition that existed in the previous
   * findOne → create two-step approach. If two identical webhooks arrive within
   * milliseconds, only the first claims the "in_progress" lock; the second sees
   * the existing record and returns early.
   *
   * Ref: IETF draft-ietf-httpapi-idempotency-key-header-07
   *   https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ body?: Record<string, unknown>; ip?: string }>();
    const body: Record<string, unknown> = request.body ?? {};
    const payloadHash = this.computeDedupKey(body);
    const startTime = Date.now();

    // Atomic upsert: only the first request inserts; concurrent duplicates find the existing record
    return from(
      this.webhookEventModel.findOneAndUpdate(
        { payloadHash },
        {
          $setOnInsert: {
            payloadHash,
            eventType: typeof body.type === "string" ? body.type : undefined,
            locationId: (body.location as Record<string, unknown> | undefined)
              ?.id as string | undefined,
            disposition: "in_progress" as const,
            ipAddress: request.ip,
          },
        },
        { upsert: true, new: false },
      ),
    ).pipe(
      switchMap((existing) => {
        if (existing) {
          this.logger.log(
            `Duplicate webhook detected — hash prefix: ${payloadHash.slice(0, 12)}, ` +
              `event type: ${typeof body.type === "string" ? body.type : "unknown"}`,
          );
          return of({ success: true });
        }

        return next.handle().pipe(
          tap(() => {
            void this.finaliseAcceptedEvent(payloadHash, startTime);
          }),
        );
      }),
    );
  }

  /**
   * Transitions an in_progress webhook event to "accepted" after successful processing.
   * @param {string} payloadHash - The dedup key identifying the event.
   * @param {number} startTime - Timestamp when the webhook event was received.
   */
  private async finaliseAcceptedEvent(
    payloadHash: string,
    startTime: number,
  ): Promise<void> {
    try {
      await this.webhookEventModel.updateOne(
        { payloadHash },
        {
          $set: {
            disposition: "accepted",
            processingMs: Date.now() - startTime,
          },
        },
      );
    } catch (err: unknown) {
      const mongoErr = err as { message?: string };
      this.logger.error(
        `Failed to finalise webhook event: ${mongoErr.message ?? "unknown error"}`,
      );
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
