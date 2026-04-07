import { HttpException, HttpStatus } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { RateLimitingGuard } from "./rate-limiting.guard";
import { RateLimitingService } from "./rate-limiting.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CounterResult } from "./rate-limiting.types";

describe("RateLimitingGuard", () => {
  let guard: RateLimitingGuard;
  let mockRateLimitingService: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;
  let mockAnalyticsService: Record<string, jest.Mock>;

  const allowedResult: CounterResult = {
    allowed: true,
    limit: 100,
    remaining: 99,
    resetAt: new Date(Date.now() + 60_000),
  };

  const blockedResult: CounterResult = {
    allowed: false,
    limit: 100,
    remaining: 0,
    resetAt: new Date(Date.now() + 60_000),
  };

  /**
   * Creates a mock ExecutionContext for testing the guard.
   * @param path - The request path.
   * @param method - The HTTP method.
   * @param ip - The client IP address.
   * @param headers - Optional additional headers.
   * @param user - Optional user object (simulates authenticated request).
   */
  function createMockContext(
    path: string,
    method: string,
    ip: string,
    headers: Record<string, string> = {},
    user?: { id: string },
  ) {
    const req = {
      path,
      url: path,
      method,
      ip,
      socket: { remoteAddress: ip },
      headers,
      user,
    };
    const res = {
      setHeader: jest.fn(),
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      res,
    } as any;
  }

  beforeEach(async () => {
    mockRateLimitingService = {
      determineTier: jest.fn().mockReturnValue({
        tier: "read",
        limit: 100,
        windowSeconds: 60,
      }),
      buildKey: jest.fn().mockReturnValue("read:GET:ip_192.168.1.1"),
      checkAndIncrement: jest.fn().mockResolvedValue(allowedResult),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    mockAnalyticsService = {
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitingGuard,
        { provide: RateLimitingService, useValue: mockRateLimitingService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    guard = module.get<RateLimitingGuard>(RateLimitingGuard);
  });

  // --- Basic allow/block ---

  it("should allow a request under the rate limit", async () => {
    const ctx = createMockContext("/conversations", "GET", "192.168.1.1");
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("should throw 429 when rate limit is exceeded", async () => {
    mockRateLimitingService.checkAndIncrement.mockResolvedValue(blockedResult);
    const ctx = createMockContext("/conversations", "GET", "192.168.1.1");

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(ctx);
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  // --- Response headers ---

  it("should set X-RateLimit-* headers on allowed requests", async () => {
    const ctx = createMockContext("/conversations", "GET", "192.168.1.1");
    await guard.canActivate(ctx);

    const res = ctx.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 100);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 99);
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-RateLimit-Reset",
      expect.any(Number),
    );
  });

  it("should set Retry-After header on blocked requests", async () => {
    mockRateLimitingService.checkAndIncrement.mockResolvedValue(blockedResult);
    const ctx = createMockContext("/conversations", "GET", "192.168.1.1");

    try {
      await guard.canActivate(ctx);
    } catch {
      // expected
    }

    const res = ctx.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith(
      "Retry-After",
      expect.any(Number),
    );
  });

  // --- Webhook exclusion ---

  it("should skip rate limiting for /webhooks/ghl", async () => {
    const ctx = createMockContext("/webhooks/ghl", "POST", "10.0.0.1");
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockRateLimitingService.checkAndIncrement).not.toHaveBeenCalled();
  });

  it("should skip rate limiting for /ghl/webhook/inbound", async () => {
    const ctx = createMockContext("/ghl/webhook/inbound", "POST", "10.0.0.1");
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockRateLimitingService.checkAndIncrement).not.toHaveBeenCalled();
  });

  it("should NOT skip rate limiting for /conversations", async () => {
    const ctx = createMockContext("/conversations", "GET", "192.168.1.1");
    await guard.canActivate(ctx);
    expect(mockRateLimitingService.checkAndIncrement).toHaveBeenCalled();
  });

  // --- Internal service bypass ---

  it("should bypass rate limiting with a valid internal service key", async () => {
    mockConfigService.get.mockReturnValue("my-secret-key");
    // Rebuild guard with the configured key
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitingGuard,
        { provide: RateLimitingService, useValue: mockRateLimitingService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();
    const guardWithKey = module.get<RateLimitingGuard>(RateLimitingGuard);

    const ctx = createMockContext("/conversations", "GET", "192.168.1.1", {
      "x-internal-service-key": "my-secret-key",
    });
    const result = await guardWithKey.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockRateLimitingService.checkAndIncrement).not.toHaveBeenCalled();
  });

  it("should rate limit normally with an invalid internal service key", async () => {
    mockConfigService.get.mockReturnValue("my-secret-key");
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitingGuard,
        { provide: RateLimitingService, useValue: mockRateLimitingService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();
    const guardWithKey = module.get<RateLimitingGuard>(RateLimitingGuard);

    const ctx = createMockContext("/conversations", "GET", "192.168.1.1", {
      "x-internal-service-key": "wrong-key-here",
    });
    await guardWithKey.canActivate(ctx);

    expect(mockRateLimitingService.checkAndIncrement).toHaveBeenCalled();
  });

  // --- Tier classification ---

  it("should classify /auth/login as auth tier", async () => {
    const ctx = createMockContext("/auth/login", "POST", "192.168.1.1");
    await guard.canActivate(ctx);

    expect(mockRateLimitingService.determineTier).toHaveBeenCalledWith(
      "/auth/login",
      "POST",
    );
  });

  it("should classify GET /clinics as read tier", async () => {
    const ctx = createMockContext("/clinics", "GET", "192.168.1.1");
    await guard.canActivate(ctx);

    expect(mockRateLimitingService.determineTier).toHaveBeenCalledWith(
      "/clinics",
      "GET",
    );
  });

  it("should classify POST /appointments/book as write tier", async () => {
    const ctx = createMockContext("/appointments/book", "POST", "192.168.1.1");
    await guard.canActivate(ctx);

    expect(mockRateLimitingService.determineTier).toHaveBeenCalledWith(
      "/appointments/book",
      "POST",
    );
  });

  // --- Identifier extraction ---

  it("should use user ID as identifier when available", async () => {
    const ctx = createMockContext(
      "/conversations",
      "GET",
      "192.168.1.1",
      {},
      { id: "user123" },
    );
    await guard.canActivate(ctx);

    expect(mockRateLimitingService.buildKey).toHaveBeenCalledWith(
      "read",
      "GET",
      "user_user123",
    );
  });

  it("should fall back to IP when no user is present", async () => {
    const ctx = createMockContext("/conversations", "GET", "10.0.0.5");
    await guard.canActivate(ctx);

    expect(mockRateLimitingService.buildKey).toHaveBeenCalledWith(
      "read",
      "GET",
      "ip_10.0.0.5",
    );
  });

  // --- Security event logging ---

  it("should log a security event when rate limit is exceeded", async () => {
    mockRateLimitingService.checkAndIncrement.mockResolvedValue(blockedResult);
    const ctx = createMockContext("/conversations", "GET", "192.168.1.1");

    try {
      await guard.canActivate(ctx);
    } catch {
      // expected
    }

    expect(mockAnalyticsService.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "rate_limit_exceeded",
        ip: "192.168.1.1",
        endpoint: "/conversations",
        tier: "read",
      }),
    );
  });

  // --- Automatic protection ---

  it("should rate limit a new unknown route automatically", async () => {
    const ctx = createMockContext("/some-new-route", "GET", "192.168.1.1");
    await guard.canActivate(ctx);
    expect(mockRateLimitingService.checkAndIncrement).toHaveBeenCalled();
  });
});
