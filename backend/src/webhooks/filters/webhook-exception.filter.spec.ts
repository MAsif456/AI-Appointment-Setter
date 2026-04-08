import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import {
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { WebhookExceptionFilter } from "./webhook-exception.filter";
import { WebhookEvent } from "../schemas/webhook-event.schema";

describe("WebhookExceptionFilter", () => {
  let filter: WebhookExceptionFilter;
  let mockModel: any;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();

    mockModel = { create: jest.fn().mockResolvedValue({}) };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      ip: "192.168.1.100",
      body: { type: "ContactCreate", location: { id: "loc-1" } },
    };
    mockHost = {
      /**
       * Returns an object with getRequest and getResponse methods,
       * which can be used to mock out the switch to HTTP context.
       *
       * @returns {{ getRequest: () => Request, getResponse: () => Response }}
       */
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookExceptionFilter,
        { provide: getModelToken(WebhookEvent.name), useValue: mockModel },
      ],
    }).compile();

    filter = module.get(WebhookExceptionFilter);
  });

  afterEach(() => jest.restoreAllMocks());

  it("should return 200 for UnauthorizedException (bad signature)", () => {
    filter.catch(new UnauthorizedException("Invalid signature"), mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: "Webhook received",
    });
  });

  it("should log rejected_signature for UnauthorizedException", () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn");
    filter.catch(new UnauthorizedException("Invalid signature"), mockHost);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("rejected_signature"),
    );
  });

  it("should return 200 for BadRequestException (validation failure)", () => {
    filter.catch(new BadRequestException("Missing type field"), mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: "Webhook received",
    });
  });

  it("should log rejected_validation for BadRequestException", () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn");
    filter.catch(new BadRequestException("Missing type field"), mockHost);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("rejected_validation"),
    );
  });

  it("should return 429 for rate limit exceptions", () => {
    filter.catch(
      new HttpException("Too Many Requests", HttpStatus.TOO_MANY_REQUESTS),
      mockHost,
    );
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: "Too Many Requests",
    });
  });

  it("should log rejected_rate_limit for 429 exceptions", () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn");
    filter.catch(
      new HttpException("Too Many Requests", HttpStatus.TOO_MANY_REQUESTS),
      mockHost,
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("rejected_rate_limit"),
    );
  });

  it("should return 200 for generic Error (prevents retry storm)", () => {
    filter.catch(new Error("Something unexpected"), mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
  });

  it("should handle non-Error exceptions gracefully", () => {
    filter.catch("string-error", mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
  });

  it("should persist a WebhookEvent document on rejection", async () => {
    filter.catch(new UnauthorizedException("Bad sig"), mockHost);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        disposition: "rejected_signature",
        eventType: "ContactCreate",
        locationId: "loc-1",
        ipAddress: "192.168.1.100",
        rejectionReason: "Bad sig",
      }),
    );
  });

  it("should not let DB write failure affect the HTTP response", () => {
    mockModel.create.mockRejectedValue(new Error("DB down"));
    expect(() => {
      filter.catch(new UnauthorizedException("Bad sig"), mockHost);
    }).not.toThrow();
    expect(mockResponse.status).toHaveBeenCalledWith(200);
  });
});
