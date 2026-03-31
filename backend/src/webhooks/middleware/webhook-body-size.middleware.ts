import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { RawBodyRequest } from "@nestjs/common";
import { MAX_BODY_SIZE_BYTES } from "../constants/webhook.constants";

@Injectable()
export class WebhookBodySizeMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WebhookBodySizeMiddleware.name);

  /**
   * A middleware function that checks the size of the incoming webhook request body
   * and rejects the request if it exceeds the maximum allowed size.
   *
   * @param req The incoming request object with a rawBody property.
   * @param res The response object to send a response back to the client.
   * @param next The next function to call in the middleware chain.
   */
  use(req: RawBodyRequest<Request>, res: Response, next: NextFunction): void {
    const rawBody = req.rawBody;

    if (!rawBody) {
      this.logger.warn(
        "rawBody not available — ensure rawBody: true in NestFactory.create(). " +
          "Body size check skipped.",
      );
      next();
      return;
    }

    if (rawBody.length > MAX_BODY_SIZE_BYTES) {
      this.logger.warn(
        `Webhook rejected: payload size ${rawBody.length} bytes exceeds ` +
          `limit of ${MAX_BODY_SIZE_BYTES} bytes`,
      );
      res.status(413).json({ success: false, error: "Payload too large" });
      return;
    }

    next();
  }
}
