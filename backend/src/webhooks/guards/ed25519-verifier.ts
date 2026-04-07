import { Logger } from "@nestjs/common";
import { verify } from "crypto";
import { GHL_ED25519_PUBLIC_KEY } from "../constants/webhook.constants";

const logger = new Logger("Ed25519Verifier");

/**
 * Verifies the Ed25519 signature of the incoming request.
 * If the signature is invalid, an UnauthorizedException is thrown.
 * @param {Buffer} rawBody - The raw request body as a Buffer.
 * @param {string} signature - The Ed25519 signature to verify.
 * @returns {boolean} true if the signature is valid, false otherwise.
 *
 * Ref: https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/index.html
 * Ref: https://nodejs.org/api/crypto.html
 */
export function verifyEd25519Signature(
  rawBody: Buffer,
  signature: string,
): boolean {
  try {
    const signatureBuffer = Buffer.from(signature, "base64");
    const isValid = verify(
      null,
      rawBody,
      GHL_ED25519_PUBLIC_KEY,
      signatureBuffer,
    );

    if (!isValid) {
      logger.warn(
        `Webhook rejected: invalid Ed25519 signature (prefix: ${signature.slice(0, 8)})`,
      );
    }

    return isValid;
  } catch (err) {
    logger.warn(
      `Webhook rejected: Ed25519 verification error — ${(err as Error).message}`,
    );
    return false;
  }
}
