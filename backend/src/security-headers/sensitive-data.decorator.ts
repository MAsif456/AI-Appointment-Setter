import { SetMetadata } from "@nestjs/common";

/**
 * Metadata key used to mark route handlers (or entire controllers) as
 * returning sensitive patient data. The CacheControlInterceptor reads this
 * key via `Reflector` and applies strict no-store cache headers to any
 * request whose handler or controller class is tagged with it.
 *
 * Exported so unit tests and the interceptor can reference the same key
 * without string duplication.
 */
export const SENSITIVE_DATA_METADATA_KEY = "security-headers:sensitive-data";

/**
 * Route decorator that marks a handler as returning patient-identifiable
 * data (names, phone numbers, postcodes, conversation history, booking
 * details, authentication tokens, and so on).
 *
 * Usage:
 *
 * ```ts
 * @SensitiveData()
 * @Get(":id")
 * getConversation(@Param("id") id: string) { ... }
 * ```
 *
 * Can also be applied at the controller class level to cover every
 * handler in that controller without repeating the decorator per method.
 *
 * Design rationale: we use a metadata-driven pattern rather than
 * hardcoding a list of sensitive route paths inside the interceptor.
 * This keeps the security boundary visible at the point where the
 * handler is defined (developers have to consciously mark a route as
 * sensitive) and prevents new patient-data routes from being silently
 * cacheable when added in the future.
 *
 * @returns A NestJS decorator that attaches `true` to the route's metadata.
 */
export const SensitiveData = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SENSITIVE_DATA_METADATA_KEY, true);
