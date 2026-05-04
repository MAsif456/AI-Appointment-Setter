import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import {
  CallHandler,
  ConflictException,
  ExecutionContext,
} from "@nestjs/common";
import { of } from "rxjs";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyKey } from "./idempotency-key.schema";
import { createHash } from "crypto";

describe("IdempotencyInterceptor", () => {
  let interceptor: IdempotencyInterceptor;
  let idempotencyModel: { findOne: jest.Mock; create: jest.Mock };

  const mockBody = {
    clinicId: "c1",
    contactId: "ct1",
    startTime: "2026-03-17T14:00:00Z",
  };
  const bodyHash = createHash("sha256")
    .update(JSON.stringify(mockBody))
    .digest("hex");

  /**
   * Creates a mock ExecutionContext object for testing the IdempotencyInterceptor.
   *
   * @param {Record<string, string>} headers - HTTP request headers.
   * @param {any} body - HTTP request body.
   * @returns {ExecutionContext} - A mock ExecutionContext object.
   */
  function createContext(
    headers: Record<string, string>,
    body: any,
  ): ExecutionContext {
    return {
      /**
       * Returns a mock HTTP request object containing the provided headers and body.
       *
       * @returns {{ getRequest: () => { headers: Record<string, string>, body: any } }}
       */
      switchToHttp: () => ({
        getRequest: () => ({ headers, body }),
      }),
    } as any;
  }

  const nextHandler: CallHandler = {
    handle: () => of({ success: true, appointmentId: "apt_1" }),
  };

  beforeEach(async () => {
    idempotencyModel = {
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        {
          provide: getModelToken(IdempotencyKey.name),
          useValue: idempotencyModel,
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
  });

  it("should pass through when no idempotency key header is present", (done) => {
    const ctx = createContext({}, mockBody);
    interceptor.intercept(ctx, nextHandler).subscribe((result) => {
      expect(result).toEqual({ success: true, appointmentId: "apt_1" });
      expect(idempotencyModel.findOne).not.toHaveBeenCalled();
      done();
    });
  });

  it("should execute handler and cache result for new idempotency key", (done) => {
    idempotencyModel.findOne.mockResolvedValue(null);

    const ctx = createContext({ "idempotency-key": "key-123" }, mockBody);
    interceptor.intercept(ctx, nextHandler).subscribe((result) => {
      expect(result).toEqual({ success: true, appointmentId: "apt_1" });
      // Allow async tap to complete
      setTimeout(() => {
        expect(idempotencyModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            key: "key-123",
            payloadHash: bodyHash,
            response: { success: true, appointmentId: "apt_1" },
          }),
        );
        done();
      }, 10);
    });
  });

  it("should return cached response for duplicate idempotency key with same payload", (done) => {
    const cachedResponse = { success: true, appointmentId: "apt_1" };
    idempotencyModel.findOne.mockResolvedValue({
      key: "key-123",
      payloadHash: bodyHash,
      response: cachedResponse,
    });

    const spy = jest.fn();
    const spyHandler: CallHandler = { handle: () => of(spy()) };

    const ctx = createContext({ "idempotency-key": "key-123" }, mockBody);
    interceptor.intercept(ctx, spyHandler).subscribe((result) => {
      expect(result).toEqual(cachedResponse);
      expect(spy).not.toHaveBeenCalled(); // Handler should NOT be called
      done();
    });
  });

  it("should throw ConflictException when key is reused with different payload", (done) => {
    idempotencyModel.findOne.mockResolvedValue({
      key: "key-123",
      payloadHash: "different-hash",
      response: {},
    });

    const ctx = createContext({ "idempotency-key": "key-123" }, mockBody);
    interceptor.intercept(ctx, nextHandler).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(ConflictException);
        done();
      },
    });
  });
});
