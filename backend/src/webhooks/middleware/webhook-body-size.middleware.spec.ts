import { WebhookBodySizeMiddleware } from "./webhook-body-size.middleware";
import { MAX_BODY_SIZE_BYTES } from "../constants/webhook.constants";
import { Logger } from "@nestjs/common";

describe("WebhookBodySizeMiddleware", () => {
  let middleware: WebhookBodySizeMiddleware;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    middleware = new WebhookBodySizeMiddleware();
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockReq = {};
  });

  afterEach(() => jest.restoreAllMocks());

  it("should call next() for payloads within the size limit", () => {
    mockReq.rawBody = Buffer.alloc(1024);
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("should call next() for payloads exactly at the size limit", () => {
    mockReq.rawBody = Buffer.alloc(MAX_BODY_SIZE_BYTES);
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it("should reject payloads exceeding the size limit with 413", () => {
    mockReq.rawBody = Buffer.alloc(MAX_BODY_SIZE_BYTES + 1);
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(413);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "Payload too large",
    });
  });

  it("should log a warning when payload exceeds the size limit", () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn");
    mockReq.rawBody = Buffer.alloc(MAX_BODY_SIZE_BYTES + 100);
    middleware.use(mockReq, mockRes, mockNext);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("payload size"),
    );
  });

  it("should call next() and warn when rawBody is not available", () => {
    mockReq.rawBody = undefined;
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining("rawBody not available"),
    );
  });

  it("should call next() for empty payloads (zero bytes)", () => {
    mockReq.rawBody = Buffer.alloc(0);
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});
