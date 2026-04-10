import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Response } from "express";
import { Observable } from "rxjs";
import { SENSITIVE_DATA_METADATA_KEY } from "./sensitive-data.decorator";

/**
 * Cache-Control values applied to responses from routes marked with
 * `@SensitiveData()`. Exported as named constants so tests can assert
 * the exact strings rather than re-declaring them.
 *
 * The combination of `no-store`, `no-cache`, `must-revalidate` and
 * `private` is the defence-in-depth recipe recommended by OWASP for
 * responses containing personal data: it defeats browser caches, shared
 * proxies, CDNs and back/forward restorations.
 *
 * `Pragma: no-cache` is included purely for HTTP/1.0 compatibility with
 * ancient downstream proxies that still honour it.
 */
export const SENSITIVE_CACHE_CONTROL =
  "no-store, no-cache, must-revalidate, private";
export const SENSITIVE_PRAGMA = "no-cache";

/**
 * Global interceptor that enforces strict no-store cache headers on any
 * response produced by a handler (or controller class) marked with the
 * `@SensitiveData()` decorator.
 *
 * Registered in AppModule via `APP_INTERCEPTOR` so new patient-data
 * routes get the correct cache headers automatically as long as the
 * developer adds the decorator. Routes without the decorator are
 * untouched and may use whatever caching their controller chooses.
 *
 * Fail-open: if header generation throws for any reason (for example,
 * if the response object has already been flushed) the interceptor
 * logs a warning and allows the request to continue. Security headers
 * must never crash the application.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheControlInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  /**
   * Checks the handler and controller metadata for the SensitiveData flag
   * and, if found, sets the strict cache-control headers on the outgoing
   * response before the handler runs.
   *
   * @param context - Current NestJS execution context.
   * @param next - The next handler in the pipeline.
   * @returns The handler's observable, unchanged.
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const isSensitive = this.reflector.getAllAndOverride<boolean>(
      SENSITIVE_DATA_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isSensitive) {
      try {
        const res = context.switchToHttp().getResponse<Response>();
        res.setHeader("Cache-Control", SENSITIVE_CACHE_CONTROL);
        res.setHeader("Pragma", SENSITIVE_PRAGMA);
      } catch (err) {
        // Fail-open: never block a legitimate request because we could
        // not stamp a cache header on its response.
        this.logger.warn(
          `Failed to apply sensitive cache-control headers: ${(err as Error).message}`,
        );
      }
    }

    return next.handle();
  }
}
