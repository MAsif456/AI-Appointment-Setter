import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";

/**
 * Replacement for the unmaintained `express-mongo-sanitize` package,
 * which is incompatible with Express 5 because it reassigns the
 * `req.query` property (now a getter). We mutate the underlying object
 * in place instead, so the same getter still serves the cleaned value.
 *
 * Strips any object key that:
 *   - starts with `$` (Mongo operator prefix), or
 *   - contains `.` (Mongo nested-path access).
 *
 * Both shapes are the canonical NoSQL injection vector in driver-level
 * queries — the OWASP NoSQL injection cheat sheet recommends operator
 * stripping at the HTTP boundary as the cheapest line of defence.
 */
const FORBIDDEN_KEY = /(^\$)|(\.)/;

/**
 * Recursively strips Mongo-operator keys from a value in place.
 * Object/array literals are mutated; primitive values are returned untouched.
 * A WeakSet of visited references defends against cyclic payloads.
 *
 * @param value - The value to scrub. May be any JSON-shaped data.
 * @param seen - Internal accumulator of already-visited objects.
 * @returns The same value, with forbidden keys removed.
 */
function scrub(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) scrub(item, seen);
    return value;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY.test(key)) {
      delete (value as Record<string, unknown>)[key];
      continue;
    }
    scrub((value as Record<string, unknown>)[key], seen);
  }
  return value;
}

/**
 * Global NestJS interceptor that strips Mongo-operator keys from
 * `req.body`, `req.query`, and `req.params` before any controller runs.
 *
 * Implemented as an interceptor (not Express middleware) for two
 * reasons: (1) it benefits from Nest's DI/testing surface, (2) it
 * mutates the existing object rather than reassigning, so it works
 * with Express 5's getter-only `req.query`.
 *
 * Fail-open by design — security middleware must never crash the app.
 */
@Injectable()
export class MongoOperatorSanitiserInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MongoOperatorSanitiserInterceptor.name);

  /**
   * Strips Mongo operator keys from the incoming request payloads.
   * @param context - Current NestJS execution context.
   * @param next - The next handler in the pipeline.
   * @returns The handler's observable, unchanged.
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    try {
      const req = context.switchToHttp().getRequest<Request>();
      if (req?.body) scrub(req.body);
      if (req?.query) scrub(req.query);
      if (req?.params) scrub(req.params);
    } catch (err) {
      this.logger.warn(
        `Mongo operator scrub failed: ${(err as Error).message}`,
      );
    }
    return next.handle();
  }
}
