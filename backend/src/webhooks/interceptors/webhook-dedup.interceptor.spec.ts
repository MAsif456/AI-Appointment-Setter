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
 * Creates a mock ExecutionContext object for testing the WebhookDedupInterceptor.
 *
 * @param {Record<string, unknown>} body - The request body to use in the mock context.
 * @returns {ExecutionContext} - A mockExecutionContext object.
 */
  function createMockContext(body: Record<string, unknown>) {
    return {
/**
 * Returns a mock HTTP request object containing the provided body and IP address.
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

    mockModel = {
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
    };
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

  it("should execute the handler for a new payload (upsert inserts, returns null)", async () => {
    // findOneAndUpdate with { new: false } returns null when a new doc is inserted
    mockModel.findOneAndUpdate.mockResolvedValue(null);

    const ctx = createMockContext(testPayload);
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );

    expect(result).toEqual({ success: true });
    expect(mockCallHandler.handle).toHaveBeenCalled();
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { payloadHash: testPayloadHash },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          payloadHash: testPayloadHash,
          disposition: "in_progress",
        }),
      }),
      { upsert: true, new: false },
    );
  });

  it("should finalise the event as 'accepted' after successful processing", async () => {
    mockModel.findOneAndUpdate.mockResolvedValue(null);

    const ctx = createMockContext(testPayload);
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { payloadHash: testPayloadHash },
      expect.objectContaining({
        $set: expect.objectContaining({ disposition: "accepted" }),
      }),
    );
  });

  it("should return { success: true } without calling handler for duplicates", async () => {
    // findOneAndUpdate returns the existing doc when it already exists
    mockModel.findOneAndUpdate.mockResolvedValue({
      payloadHash: testPayloadHash,
      disposition: "in_progress",
    });

    const ctx = createMockContext(testPayload);
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );

    expect(result).toEqual({ success: true });
    expect(mockCallHandler.handle).not.toHaveBeenCalled();
  });

  it("should also detect duplicates when existing record has 'accepted' disposition", async () => {
    mockModel.findOneAndUpdate.mockResolvedValue({
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
    mockModel.findOneAndUpdate.mockResolvedValue({
      payloadHash: testPayloadHash,
      disposition: "accepted",
    });

    const ctx = createMockContext(testPayload);
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Duplicate webhook detected"),
    );
  });

  it("should include event type in duplicate log message", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log");
    mockModel.findOneAndUpdate.mockResolvedValue({
      payloadHash: testPayloadHash,
      disposition: "accepted",
    });

    const ctx = createMockContext(testPayload);
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("ContactCreate"),
    );
  });

  it("should log and not crash on finalise errors", async () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error");
    mockModel.findOneAndUpdate.mockResolvedValue(null);
    mockModel.updateOne.mockRejectedValue(new Error("DB connection lost"));

    const ctx = createMockContext(testPayload);
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(result).toEqual({ success: true });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to finalise webhook event"),
    );
  });

  it("should use webhookDeliveryId as dedup key when present", async () => {
    const payload = { ...testPayload, webhookDeliveryId: "ghl-delivery-12345" };
    mockModel.findOneAndUpdate.mockResolvedValue(null);

    const ctx = createMockContext(payload);
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));

    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { payloadHash: "ghl:ghl-delivery-12345" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("should handle an empty payload body", async () => {
    mockModel.findOneAndUpdate.mockResolvedValue(null);

    const ctx = createMockContext({});
    const result = await lastValueFrom(
      interceptor.intercept(ctx, mockCallHandler),
    );

    expect(result).toEqual({ success: true });
    expect(mockCallHandler.handle).toHaveBeenCalled();
  });

  it("should set eventType to undefined for payloads without a type field", async () => {
    mockModel.findOneAndUpdate.mockResolvedValue(null);

    const ctx = createMockContext({ data: "no-type" });
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));

    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          eventType: undefined,
        }),
      }),
      expect.anything(),
    );
  });

  it("should extract locationId from nested location object", async () => {
    mockModel.findOneAndUpdate.mockResolvedValue(null);

    const ctx = createMockContext({ location: { id: "loc_test_123" } });
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));

    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          locationId: "loc_test_123",
        }),
      }),
      expect.anything(),
    );
  });

  it("should set locationId to undefined when location is absent", async () => {
    mockModel.findOneAndUpdate.mockResolvedValue(null);

    const ctx = createMockContext({ type: "InboundMessage" });
    await lastValueFrom(interceptor.intercept(ctx, mockCallHandler));

    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          locationId: undefined,
        }),
      }),
      expect.anything(),
    );
  });
});
