import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { RateLimitingService } from "./rate-limiting.service";
import { RateLimitCounter } from "./schemas/rate-limit-counter.schema";
import { RateLimitConfig } from "./rate-limiting.types";

describe("RateLimitingService", () => {
  let service: RateLimitingService;
  let mockCounterModel: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;

  const readTier: RateLimitConfig = {
    tier: "read",
    limit: 100,
    windowSeconds: 60,
  };

  beforeEach(async () => {
    mockCounterModel = {
      findOneAndUpdate: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitingService,
        {
          provide: getModelToken(RateLimitCounter.name),
          useValue: mockCounterModel,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RateLimitingService>(RateLimitingService);
  });

  // --- determineTier ---

  describe("determineTier", () => {
    it("should return auth tier for /auth paths", () => {
      const result = service.determineTier("/auth/login", "POST");
      expect(result.tier).toBe("auth");
    });

    it("should return auth tier for /auth/register", () => {
      const result = service.determineTier("/auth/register", "POST");
      expect(result.tier).toBe("auth");
    });

    it("should return read tier for GET requests", () => {
      const result = service.determineTier("/conversations", "GET");
      expect(result.tier).toBe("read");
    });

    it("should return read tier for HEAD requests", () => {
      const result = service.determineTier("/health", "HEAD");
      expect(result.tier).toBe("read");
    });

    it("should return read tier for OPTIONS requests", () => {
      const result = service.determineTier("/clinics", "OPTIONS");
      expect(result.tier).toBe("read");
    });

    it("should return write tier for POST requests", () => {
      const result = service.determineTier("/conversations/123/messages", "POST");
      expect(result.tier).toBe("write");
    });

    it("should return write tier for PUT requests", () => {
      const result = service.determineTier("/api/clinics/1/ai-settings", "PUT");
      expect(result.tier).toBe("write");
    });

    it("should return write tier for PATCH requests", () => {
      const result = service.determineTier("/clinics/1/deactivate", "PATCH");
      expect(result.tier).toBe("write");
    });

    it("should return write tier for DELETE requests", () => {
      const result = service.determineTier("/clinics/1", "DELETE");
      expect(result.tier).toBe("write");
    });
  });

  // --- buildKey ---

  describe("buildKey", () => {
    it("should build a composite key with tier, method, and identifier", () => {
      const key = service.buildKey("read", "GET", "ip_192.168.1.1");
      expect(key).toBe("read:GET:ip_192.168.1.1");
    });

    it("should uppercase the method in the key", () => {
      const key = service.buildKey("write", "post", "user_abc123");
      expect(key).toBe("write:POST:user_abc123");
    });
  });

  // --- checkAndIncrement ---

  describe("checkAndIncrement", () => {
    it("should allow a request when count is under the limit", async () => {
      mockCounterModel.findOneAndUpdate.mockResolvedValue({ count: 1 });

      const result = await service.checkAndIncrement("test-key", readTier);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(99);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it("should allow a request when count equals the limit", async () => {
      mockCounterModel.findOneAndUpdate.mockResolvedValue({ count: 100 });

      const result = await service.checkAndIncrement("test-key", readTier);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("should reject a request when count exceeds the limit", async () => {
      mockCounterModel.findOneAndUpdate.mockResolvedValue({ count: 101 });

      const result = await service.checkAndIncrement("test-key", readTier);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should first try to increment an existing counter in the current window", async () => {
      mockCounterModel.findOneAndUpdate.mockResolvedValue({ count: 1 });

      await service.checkAndIncrement("test-key", readTier);

      // First call: try to increment existing counter (no upsert)
      expect(mockCounterModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ key: "test-key" }),
        { $inc: { count: 1 } },
        { new: true },
      );
    });

    it("should create a new counter when no current-window counter exists", async () => {
      // First call returns null (no existing counter), second creates one
      mockCounterModel.findOneAndUpdate
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ count: 1 });

      await service.checkAndIncrement("test-key", readTier);

      // Second call: upsert with $set to reset the counter
      expect(mockCounterModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(mockCounterModel.findOneAndUpdate).toHaveBeenLastCalledWith(
        { key: "test-key" },
        expect.objectContaining({
          $set: expect.objectContaining({ count: 1 }),
        }),
        { upsert: true, new: true },
      );
    });

    it("should fail-open when the database throws an error", async () => {
      mockCounterModel.findOneAndUpdate.mockRejectedValue(
        new Error("DB connection lost"),
      );
      jest.spyOn(service["logger"], "warn").mockImplementation();

      const result = await service.checkAndIncrement("test-key", readTier);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(100);
    });

    it("should log a warning when the database is unavailable", async () => {
      mockCounterModel.findOneAndUpdate.mockRejectedValue(
        new Error("DB timeout"),
      );
      const warnSpy = jest
        .spyOn(service["logger"], "warn")
        .mockImplementation();

      await service.checkAndIncrement("test-key", readTier);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("DB timeout"),
      );
    });
  });

  // --- Environment variable overrides ---

  describe("tier configuration from env vars", () => {
    it("should use env var overrides when provided", async () => {
      const customConfig: Record<string, jest.Mock> = {
        get: jest.fn((key: string) => {
          const overrides: Record<string, number> = {
            RATE_LIMIT_READ_LIMIT: 200,
            RATE_LIMIT_READ_WINDOW_SECONDS: 120,
          };
          return overrides[key] ?? undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimitingService,
          {
            provide: getModelToken(RateLimitCounter.name),
            useValue: mockCounterModel,
          },
          { provide: ConfigService, useValue: customConfig },
        ],
      }).compile();

      const customService =
        module.get<RateLimitingService>(RateLimitingService);
      const tier = customService.determineTier("/conversations", "GET");

      expect(tier.limit).toBe(200);
      expect(tier.windowSeconds).toBe(120);
    });

    it("should fall back to defaults when env vars are not set", () => {
      const tier = service.determineTier("/conversations", "GET");
      expect(tier.limit).toBe(100);
      expect(tier.windowSeconds).toBe(60);
    });
  });
});
