import { Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import {
  HMAC_TIMESTAMP_HEADER,
  MAX_TIMESTAMP_DRIFT_MS,
} from "../constants/webhook.constants";

const logger = new Logger("HmacVerifier");

export interface HmacVerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies the HMAC signature of the incoming request.
 * If the signature is invalid or the GHL_WEBHOOK_SECRET is not configured,
 * an UnauthorizedException is thrown.
 * @param {Buffer} rawBody - The raw request body as a Buffer.
 * @param {string} signature - The HMAC signature to verify.
 * @param {Record<string, string | string[] | undefined>} headers - The request headers.
 * @param {string} secret - The webhook secret.
 * @returns {HmacVerifyResult} An object containing the result of the HMAC verification and an optional reason string.
 * @throws {UnauthorizedException} If the signature is invalid or the GHL_WEBHOOK_SECRET is not configured.
 *
 * Ref: https://webhooks.fyi/security/hmac
 * Ref: https://webhooks.fyi/security/replay-prevention
 * Ref: https://nodejs.org/api/crypto.html
 */
export function verifyHmacSignature(
  rawBody: Buffer,
  signature: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): HmacVerifyResult {
  const timestamp = headers[HMAC_TIMESTAMP_HEADER] as string | undefined;
  if (!timestamp) {
    logger.warn(
      "Webhook rejected: HMAC signature present but timestamp header missing",
    );
    return { valid: false, reason: "Missing webhook timestamp" };
  }

  const timestampMs = Number(timestamp);
  if (isNaN(timestampMs)) {
    logger.warn(`Webhook rejected: invalid timestamp format — ${timestamp}`);
    return { valid: false, reason: "Invalid webhook timestamp" };
  }

  const drift = Math.abs(Date.now() - timestampMs);
  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    logger.warn(
      `Webhook rejected: timestamp drift ${drift}ms exceeds maximum ${MAX_TIMESTAMP_DRIFT_MS}ms`,
    );
    return { valid: false, reason: "Webhook timestamp expired or invalid" };
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    logger.warn(
      `Webhook rejected: HMAC signature length mismatch (prefix: ${signature.slice(0, 8)})`,
    );
    return { valid: false, reason: "Invalid webhook signature" };
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    logger.warn(
      `Webhook rejected: invalid HMAC signature (prefix: ${signature.slice(0, 8)})`,
    );
    return { valid: false, reason: "Invalid webhook signature" };
  }

  return { valid: true };
}
