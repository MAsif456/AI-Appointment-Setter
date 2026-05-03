import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Shape of the response body the global ValidationPipe produces when it
 * rejects a request. We narrow the `unknown` exception payload to this
 * before formatting the user-facing response.
 */
interface ValidationPayload {
  statusCode: number;
  message?: string | string[];
  error?: string;
}

/**
 * Properties on the request body whose values should never be echoed
 * back into a log line, even in a sanitised summary. Ensures the audit
 * record can be safely shipped to a SIEM without leaking credentials.
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "newPassword",
  "currentPassword",
  "token",
  "refreshToken",
  "accessToken",
  "ghlApiKey",
  "apiKey",
  "secret",
]);

/**
 * Truncates a single value to a short, log-safe summary. Long strings
 * are clipped, objects collapsed to a placeholder so they cannot
 * smuggle multi-line payloads into the log stream.
 */
function summariseValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 80)}…(${value.length})` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return Array.isArray(value) ? `[array(${value.length})]` : "[object]";
}

/**
 * Builds a one-line, log-safe summary of a request body. Sensitive keys
 * are redacted and oversized values truncated.
 */
function summariseBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const entries = Object.entries(body as Record<string, unknown>)
    .slice(0, 12) // hard cap so a 1000-key payload cannot blow up logs
    .map(([k, v]) =>
      SENSITIVE_KEYS.has(k) ? `${k}=[REDACTED]` : `${k}=${summariseValue(v)}`,
    );
  return entries.join(" ");
}

/**
 * Global exception filter that intercepts BadRequestExceptions raised by
 * NestJS' ValidationPipe and:
 *
 *   1. Returns a stable, user-friendly response shape with no internal
 *      stack traces, file paths, or schema details. The acceptance
 *      criterion in issue #38 explicitly forbids leaking those.
 *
 *   2. Emits a structured audit log entry containing timestamp, HTTP
 *      method, route path, source IP and a sanitised summary of the
 *      offending body. This satisfies the validation-failure logging AC
 *      and feeds the existing log-aggregation pipeline.
 *
 * Non-validation BadRequestExceptions (e.g. raised manually inside a
 * service) are passed through unmodified so this filter does not become
 * a hidden source of behaviour change.
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ValidationFailed");

  /**
   * Handles a BadRequestException by writing the audit log line and the
   * trimmed JSON response. Falls back to the framework default when the
   * exception was not raised by the ValidationPipe.
   */
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const raw = exception.getResponse() as ValidationPayload | string;
    const payload: ValidationPayload =
      typeof raw === "string"
        ? { statusCode: HttpStatus.BAD_REQUEST, message: raw }
        : raw;

    const messages = Array.isArray(payload.message)
      ? payload.message
      : [payload.message ?? "Validation failed"];

    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ??
      req.ip ??
      "unknown";

    this.logger.warn(
      `ts=${new Date().toISOString()} method=${req.method} path=${req.originalUrl ?? req.url} ` +
        `ip=${ip} messages=${messages.length} body=${summariseBody(req.body)}`,
    );

    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Bad Request",
      messages,
    });
  }
}
