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
 * Property names which, if used as keys in a parsed JSON payload, can
 * mutate the JavaScript prototype chain and lead to Remote Code Execution
 * or auth bypass downstream. Stripped from every request before any
 * controller runs.
 *
 * Note: this is distinct from express-mongo-sanitize, which only removes
 * keys beginning with `$` or containing `.` (the MongoDB operator surface).
 * Snyk advisory SNYK-JS-EXPRESS-* tracks the wider prototype-pollution
 * vector — see https://snyk.io/vuln/SNYK-JS-LODASH-450202 for an example.
 */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Recursively strips prototype-pollution keys from a value in place.
 * Object/array literals are mutated; primitive values are returned untouched.
 * Tracks visited references to defend against pathological cyclic payloads.
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
    if (FORBIDDEN_KEYS.has(key)) {
      delete (value as Record<string, unknown>)[key];
      continue;
    }
    scrub((value as Record<string, unknown>)[key], seen);
  }
  return value;
}

/**
 * Global NestJS interceptor that removes prototype-pollution keys
 * (`__proto__`, `constructor`, `prototype`) from req.body, req.query, and
 * req.params before any controller runs.
 *
 * Implemented as an interceptor (not Express middleware) so it integrates
 * with the Nest DI/testing surface and runs after body parsing but before
 * the ValidationPipe. Fail-open: any unexpected error is logged and the
 * request is allowed to continue, because security middleware must never
 * crash the application.
 */
@Injectable()
export class PrototypePollutionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PrototypePollutionInterceptor.name);

  /**
   * Strips forbidden keys from the incoming request payloads.
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
      // Fail-open: never block a legitimate request because we could not
      // scrub its payload — the downstream ValidationPipe will still catch
      // genuinely malformed input.
      this.logger.warn(
        `Prototype-pollution scrub failed: ${(err as Error).message}`,
      );
    }
    return next.handle();
  }
}
