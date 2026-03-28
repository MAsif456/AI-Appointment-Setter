import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { CallHandler, Logger } from "@nestjs/common";
import { of, lastValueFrom } from "rxjs";
import { WebhookDedupInterceptor } from "./webhook-dedup.interceptor";
import { WebhookEvent } from "../schemas/webhook-event.schema";
import { createHash } from "crypto";

describe("WebhookDedupInterceptor", () => {
  let interceptor: WebhookDedupInterceptor;
  let mockModel: any;
  let mockCallHandler: CallHandler;

  const testPayload = { type: "ContactCreate", location: { id: "loc1" } };
  const testPayloadHash = createHash("sha256")
    .update(JSON.stringify(testPayload))
    .digest("hex");

/**
 * Creates a mock ExecutionContext for testing purposes.
 *
 * @param {Record<string, unknown>} body - The request body to use in the mock context.
 * @returns {any} - A mock ExecutionContext object with a mock HttpRequest and mock CallHandler.
 */
  function createMockContext(body: Record<string, unknown>) {
    return {
/**
 * Returns a mock HTTP request object containing the provided body and a mock IP address (127.0.0.1).
 *
 * @returns {{ getRequest: () => { body: Record<string, unknown>, ip: string } }}
 */
      switchToHttp: () => ({
        getRequest: () => ({ body, ip: "127.0.0.1" }),
      }),
    } as any;
  }

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();

    mockModel = { findOne: jest.fn(), create: jest.fn() };
    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ success: true })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDedupInterceptor,
        { provide: getModelToken(WebhookEvent.name), useValue: mockModel },
      ],
    }).compile();

    interceptor = module.get(WebhookDedupInterceptor);
  });

  afterEach(() => jest.restoreAllMocks());

  it("should execute the handler for a new payload", async () => {
    mockModel.findOne.mockResolvedValue(null);
    mockModel.create.mockResolvedValue({});

    const ctx = createMockContext(testPayload);
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );

    expect(result).toEqual({ success: true });
    expect(mockCallHandler.handle).toHaveBeenCalled();
    expect(mockModel.findOne).toHaveBeenCalledWith({
      payloadHash: testPayloadHash,
    });
  });

  it("should store the event after successful processing", async () => {
    mockModel.findOne.mockResolvedValue(null);
    mockModel.create.mockResolvedValue({});

    const ctx = createMockContext(testPayload);
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadHash: testPayloadHash,
        eventType: "ContactCreate",
        locationId: "loc1",
        disposition: "accepted",
      }),
    );
  });

  it("should return { success: true } without calling handler for duplicates", async () => {
    mockModel.findOne.mockResolvedValue({
      payloadHash: testPayloadHash,
      disposition: "accepted",
    });

    const ctx = createMockContext(testPayload);
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );

    expect(result).toEqual({ success: true });
    expect(mockCallHandler.handle).not.toHaveBeenCalled();
  });

  it("should log when a duplicate is detected", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log");
    mockModel.findOne.mockResolvedValue({
      payloadHash: testPayloadHash,
      disposition: "accepted",
    });

    const ctx = createMockContext(testPayload);
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Duplicate webhook detected"),
    );
  });

  it("should log and not crash on database create errors", async () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error");
    mockModel.findOne.mockResolvedValue(null);
    mockModel.create.mockRejectedValue(new Error("DB connection lost"));

    const ctx = createMockContext(testPayload);
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(result).toEqual({ success: true });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to store webhook event"),
    );
  });

  it("should silently ignore MongoDB duplicate key error (code 11000)", async () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error");
    mockModel.findOne.mockResolvedValue(null);
    const duplicateKeyError: any = new Error("E11000 duplicate key");
    duplicateKeyError.code = 11000;
    mockModel.create.mockRejectedValue(duplicateKeyError);

    const ctx = createMockContext(testPayload);
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(result).toEqual({ success: true });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should use webhookDeliveryId as dedup key when present", async () => {
    const payload = { ...testPayload, webhookDeliveryId: "ghl-delivery-12345" };
    mockModel.findOne.mockResolvedValue(null);
    mockModel.create.mockResolvedValue({});

    const ctx = createMockContext(payload);
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));

    expect(mockModel.findOne).toHaveBeenCalledWith({
      payloadHash: "ghl:ghl-delivery-12345",
    });
  });

  it("should handle an empty payload body", async () => {
    mockModel.findOne.mockResolvedValue(null);
    mockModel.create.mockResolvedValue({});

    const ctx = createMockContext({});
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );

    expect(result).toEqual({ success: true });
    expect(mockCallHandler.handle).toHaveBeenCalled();
  });
});
