import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  HttpStatus,
} from "@nestjs/common";
import { Response, Request } from "express";
import { Error as MongooseError } from "mongoose";

/**
 * Global exception filter that catches Mongoose connection and server errors.
 * Returns a 503 Service Unavailable response and logs the incoming request
 * body so the webhook payload can be manually replayed if needed.
 */
@Catch(MongooseError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

/**
 * Catches Mongoose connection and server errors and returns a 503 Service Unavailable response.
 * Logs the incoming request body so the webhook payload can be manually replayed if needed.
 * @param {MongooseError} exception - The Mongoose error that was thrown.
 * @param {ArgumentsHost} host - The execution context of the request.
 */
  catch(exception: MongooseError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.error(
      `Database error during ${request.method} ${request.url}: ${exception.message}`,
      exception.stack,
    );

    // Preserve the incoming payload so it can be replayed manually
    this.logger.error(
      `Preserved payload for replay: ${JSON.stringify(request.body)}`,
    );

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: "Service temporarily unavailable",
    });
  }
}
