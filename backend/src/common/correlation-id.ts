import { randomUUID } from "crypto";

/** Generates a unique correlation ID for tracing a request through the system. */
export function generateCorrelationId(): string {
  return randomUUID();
}
