import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Request, Response } from "express";
import {
  WebhookEvent,
  WebhookEventDocument,
  WebhookDisposition,
} from "../schemas/webhook-event.schema";
import { createHash } from "crypto";

@Catch()
export class WebhookExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WebhookExceptionFilter.name);

  /**
   * Constructs a new instance of the WebhookExceptionFilter.
   *
   * @param webhookEventModel - The Mongoose model of WebhookEvent documents.
   */
  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly webhookEventModel: Model<WebhookEventDocument>,
  ) {}

  /**
   * Catch any exceptions that occur in the WebhooksController, log an error message
   * containing the original HTTP status code and the response status code, and return a
   * JSON response with a success property of false and an error property containing a
   * human-readable error message.
   *
   * @param exception - The exception to catch.
   * @param host - The ArgumentsHost containing the request and response objects.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const originalStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : "Unknown error";

    const disposition = this.mapDisposition(originalStatus);
    const responseStatus = this.mapResponseStatus(originalStatus);

    const bodyRecord = (request.body ?? {}) as Record<string, unknown>;
    const eventType: string =
      typeof bodyRecord.type === "string" ? bodyRecord.type : "unknown";
    this.logger.warn(
      `Webhook ${disposition}: ${message} ` +
        `(original: ${originalStatus}, response: ${responseStatus}, ` +
        `ip: ${request.ip ?? "unknown"}, type: ${eventType})`,
    );

    this.persistEvent(request, disposition, message).catch(() => {});

    response.status(responseStatus).json({
      success: false,
      error:
        responseStatus === Number(HttpStatus.TOO_MANY_REQUESTS)
          ? "Too Many Requests"
          : "Webhook received",
    });
  }

  /**
   * Maps an HTTP status code to a WebhookDisposition.
   *
   * @param status - The HTTP status code to map.
   * @returns The corresponding WebhookDisposition.
   */
  private mapDisposition(status: number): WebhookDisposition {
    switch (status) {
      case Number(HttpStatus.UNAUTHORIZED):
        return "rejected_signature";
      case Number(HttpStatus.BAD_REQUEST):
        return "rejected_validation";
      case Number(HttpStatus.TOO_MANY_REQUESTS):
        return "rejected_rate_limit";
      default:
        return "rejected_signature";
    }
  }

  /**
   * Maps an HTTP status code to a response status code for a WebhookExceptionFilter
   * response. If the original status code is 429 (Too Many Requests), returns 429.
   * Otherwise, returns 200.
   *
   * @param originalStatus - The HTTP status code to map.
   * @returns The response status code.
   * 
   * Ref: https://dev.to/digital_trubador/webhook-security-best-practices-for-production-2025-2026-384n
   */
  private mapResponseStatus(originalStatus: number): number {
    if (originalStatus === Number(HttpStatus.TOO_MANY_REQUESTS)) {
      return HttpStatus.TOO_MANY_REQUESTS;
    }
    return HttpStatus.OK;
  }

  /**
   * Persist a WebhookEvent document to MongoDB.
   *
   * @param request - The Express request object.
   * @param disposition - The WebhookDisposition to persist.
   * @param rejectionReason - The reason for rejection (if applicable).
   * @returns A Promise that resolves when the document is persisted.
   */
  private async persistEvent(
    request: Request,
    disposition: WebhookDisposition,
    rejectionReason: string,
  ): Promise<void> {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const payloadHash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");

    await this.webhookEventModel.create({
      payloadHash: `rejected:${payloadHash}`,
      eventType: body.type as string | undefined,
      locationId: (body.location as Record<string, unknown> | undefined)?.id as
        | string
        | undefined,
      disposition,
      ipAddress: request.ip,
      rejectionReason,
    });
  }
}
