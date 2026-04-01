import { verifyHmacSignature } from "./hmac-verifier";
import { Logger } from "@nestjs/common";
import { createHmac } from "crypto";
import {
  HMAC_TIMESTAMP_HEADER,
  MAX_TIMESTAMP_DRIFT_MS,
} from "../constants/webhook.constants";

const SECRET = "test-webhook-secret-key-12345";

/**
 * Computes an HMAC signature with the given timestamp and body
 * @param {string} timestamp - the timestamp to include in the HMAC computation
 * @param {string} body - the request body to include in the HMAC computation
 * @returns {string} - the computed HMAC signature as a hexadecimal string
 */
function computeHmac(timestamp: string, body: string): string {
  return createHmac("sha256", SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

/**
 * Creates a Record of HTTP headers for a webhook request,
 * containing the HMAC signature and optionally the timestamp.
 * @param {string} sig - the HMAC signature to include in the headers
 * @param {string} [ts] - the timestamp to include in the headers (optional)
 * @returns {Record<string, string | undefined>} - the headers object
 */
function makeHeaders(
  sig: string,
  ts?: string,
): Record<string, string | undefined> {
  const h: Record<string, string | undefined> = {
    "x-webhook-signature": sig,
  };
  if (ts !== undefined) h[HMAC_TIMESTAMP_HEADER] = ts;
  return h;
}

describe("verifyHmacSignature", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return valid for a correct HMAC signature with valid timestamp", () => {
    const body = '{"type":"ContactCreate","location":{"id":"loc1"}}';
    const ts = Date.now().toString();
    const sig = computeHmac(ts, body);

    const result = verifyHmacSignature(
      Buffer.from(body),
      sig,
      makeHeaders(sig, ts),
      SECRET,
    );
    expect(result.valid).toBe(true);
  });

  it("should reject an invalid HMAC signature", () => {
    const body = '{"type":"ContactCreate"}';
    const ts = Date.now().toString();

    const result = verifyHmacSignature(
      Buffer.from(body),
      "deadbeef".repeat(8),
      makeHeaders("deadbeef".repeat(8), ts),
      SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid webhook signature");
  });

  it("should reject when timestamp header is missing", () => {
    const body = '{"type":"ContactCreate"}';
    const sig = computeHmac(Date.now().toString(), body);

    const result = verifyHmacSignature(
      Buffer.from(body),
      sig,
      makeHeaders(sig),
      SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Missing webhook timestamp");
  });

  it("should reject a timestamp older than 5 minutes", () => {
    const body = '{"type":"ContactCreate"}';
    const oldTs = (Date.now() - MAX_TIMESTAMP_DRIFT_MS - 1000).toString();
    const sig = computeHmac(oldTs, body);

    const result = verifyHmacSignature(
      Buffer.from(body),
      sig,
      makeHeaders(sig, oldTs),
      SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("expired");
  });

  it("should reject a timestamp more than 5 minutes in the future", () => {
    const body = '{"type":"ContactCreate"}';
    const futureTs = (Date.now() + MAX_TIMESTAMP_DRIFT_MS + 1000).toString();
    const sig = computeHmac(futureTs, body);

    const result = verifyHmacSignature(
      Buffer.from(body),
      sig,
      makeHeaders(sig, futureTs),
      SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("expired");
  });

  it("should reject a non-numeric timestamp", () => {
    const body = '{"type":"ContactCreate"}';

    const result = verifyHmacSignature(
      Buffer.from(body),
      "abc123",
      makeHeaders("abc123", "not-a-number"),
      SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid webhook timestamp");
  });

  it("should reject a tampered body with a valid signature for original content", () => {
    const original = '{"type":"ContactCreate","location":{"id":"loc1"}}';
    const ts = Date.now().toString();
    const sig = computeHmac(ts, original);
    const tampered = '{"type":"ContactCreate","location":{"id":"HIJACKED"}}';

    const result = verifyHmacSignature(
      Buffer.from(tampered),
      sig,
      makeHeaders(sig, ts),
      SECRET,
    );
    expect(result.valid).toBe(false);
  });
});
