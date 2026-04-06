import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException, Logger } from "@nestjs/common";
import { WebhookSignatureGuard } from "./webhook-signature.guard";
import {
  GHL_SIGNATURE_HEADER,
  HMAC_SIGNATURE_HEADER,
  HMAC_TIMESTAMP_HEADER,
} from "../constants/webhook.constants";
import { createHmac } from "crypto";

const HMAC_SECRET = "test-webhook-secret-key-12345";

/**
 * Creates a mock ExecutionContext object for testing the WebhookSignatureGuard.
 *
 * @param {Record<string, string>} headers - HTTP request headers.
 * @param {Buffer} [rawBody] - HTTP request body (optional).
 * @returns {ExecutionContext} - A mock ExecutionContext object.
 */
function createMockContext(headers: Record<string, string>, rawBody?: Buffer) {
  const req = {
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    rawBody,
    body: {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe("WebhookSignatureGuard", () => {
  let guard: WebhookSignatureGuard;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSignatureGuard,
        {
          provide: ConfigService,
          useValue: {
            /**
             * Returns the value of the specified configuration key.
             *
             * If the key is "GHL_WEBHOOK_SECRET", returns the HMAC secret used for webhook signature verification.
             * Otherwise, returns undefined.
             */
            get: (key: string) => {
              if (key === "GHL_WEBHOOK_SECRET") return HMAC_SECRET;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    guard = module.get(WebhookSignatureGuard);
  });

  afterEach(() => jest.restoreAllMocks());

  it("should allow a valid HMAC signature through", () => {
    const body = '{"type":"ContactCreate","location":{"id":"loc1"}}';
    const ts = Date.now().toString();
    const sig = createHmac("sha256", HMAC_SECRET)
      .update(`${ts}.${body}`)
      .digest("hex");

    const ctx = createMockContext(
      { [HMAC_SIGNATURE_HEADER]: sig, [HMAC_TIMESTAMP_HEADER]: ts },
      Buffer.from(body),
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should throw UnauthorizedException for invalid HMAC signature", () => {
    const ctx = createMockContext(
      {
        [HMAC_SIGNATURE_HEADER]: "deadbeef".repeat(8),
        [HMAC_TIMESTAMP_HEADER]: Date.now().toString(),
      },
      Buffer.from('{"type":"ContactCreate"}'),
    );
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException for invalid Ed25519 signature", () => {
    const ctx = createMockContext(
      { [GHL_SIGNATURE_HEADER]: Buffer.from("bad").toString("base64") },
      Buffer.from('{"type":"ContactCreate"}'),
    );
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should throw when rawBody is missing for HMAC", () => {
    const ctx = createMockContext({
      [HMAC_SIGNATURE_HEADER]: "sig",
      [HMAC_TIMESTAMP_HEADER]: Date.now().toString(),
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should throw when rawBody is missing for Ed25519", () => {
    const ctx = createMockContext({
      [GHL_SIGNATURE_HEADER]: "some-base64",
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should reject when no signature headers present but secret is configured", () => {
    const ctx = createMockContext({}, Buffer.from("{}"));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("should allow through when no secret configured and no headers (graceful degradation)", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn");

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSignatureGuard,
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    const unconfiguredGuard = module.get(WebhookSignatureGuard);
    const ctx = createMockContext({}, Buffer.from("{}"));

    expect(unconfiguredGuard.canActivate(ctx)).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("signature verification disabled"),
    );
  });
});
