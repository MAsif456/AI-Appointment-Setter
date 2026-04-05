import { HttpException, HttpStatus } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { AuthThrottleService } from "./auth-throttle.service";
import { LoginAttempt } from "./schemas/login-attempt.schema";
import { AnalyticsService } from "../analytics/analytics.service";

describe("AuthThrottleService", () => {
  let service: AuthThrottleService;
  let mockModel: Record<string, jest.Mock>;
  let mockAnalyticsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockModel = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
      deleteOne: jest.fn().mockResolvedValue({}),
    };

    mockAnalyticsService = {
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthThrottleService,
        { provide: getModelToken(LoginAttempt.name), useValue: mockModel },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    service = module.get<AuthThrottleService>(AuthThrottleService);
  });

  // --- checkThrottle ---

  describe("checkThrottle", () => {
    it("should allow attempt when no prior failures exist", async () => {
      await expect(
        service.checkThrottle("192.168.1.1", "test@example.com"),
      ).resolves.toBeUndefined();
    });

    it("should allow attempt when IP failures are under threshold (1-5)", async () => {
      mockModel.findOne.mockImplementation((query: { key: string }) => {
        if (query.key.startsWith("ip:")) {
          return Promise.resolve({ failureCount: 5 });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.checkThrottle("192.168.1.1", "test@example.com"),
      ).resolves.toBeUndefined();
    });

    it("should apply progressive delay for IP failures 6-10", async () => {
      mockModel.findOne.mockImplementation((query: { key: string }) => {
        if (query.key.startsWith("ip:")) {
          return Promise.resolve({ failureCount: 7 });
        }
        return Promise.resolve(null);
      });

      const start = Date.now();
      await service.checkThrottle("192.168.1.1", "test@example.com");
      const elapsed = Date.now() - start;

      // Should have at least some delay (may be less than 2000 in test env)
      expect(elapsed).toBeGreaterThanOrEqual(1500);
    }, 10000);

    it("should throw 429 for IP failures at 11+", async () => {
      mockModel.findOne.mockImplementation((query: { key: string }) => {
        if (query.key.startsWith("ip:")) {
          return Promise.resolve({ failureCount: 11 });
        }
        return Promise.resolve(null);
      });

      try {
        await service.checkThrottle("192.168.1.1", "test@example.com");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
        expect((err as HttpException).message).toContain(
          "Too many login attempts",
        );
      }
    });

    it("should throw 401 for account-level lockout (10+ cross-IP failures)", async () => {
      mockModel.findOne.mockImplementation((query: { key: string }) => {
        if (query.key.startsWith("account:")) {
          return Promise.resolve({ failureCount: 10 });
        }
        return Promise.resolve(null);
      });

      try {
        await service.checkThrottle("192.168.1.1", "test@example.com");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.UNAUTHORIZED,
        );
        // Generic message to prevent account enumeration
        expect((err as HttpException).message).toBe("Invalid credentials");
      }
    });

    it("should not affect different IPs when one IP is locked", async () => {
      mockModel.findOne.mockImplementation((query: { key: string }) => {
        if (query.key === "ip:10.0.0.1") {
          return Promise.resolve({ failureCount: 15 });
        }
        return Promise.resolve(null);
      });

      // IP 10.0.0.1 is locked
      await expect(
        service.checkThrottle("10.0.0.1", "test@example.com"),
      ).rejects.toThrow(HttpException);

      // IP 10.0.0.2 is fine
      mockModel.findOne.mockImplementation((query: { key: string }) => {
        if (query.key === "ip:10.0.0.2") {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      await expect(
        service.checkThrottle("10.0.0.2", "test@example.com"),
      ).resolves.toBeUndefined();
    });

    it("should not lock a different email when another is locked", async () => {
      mockModel.findOne.mockImplementation((query: { key: string }) => {
        if (query.key === "account:locked@example.com") {
          return Promise.resolve({ failureCount: 15 });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.checkThrottle("192.168.1.1", "locked@example.com"),
      ).rejects.toThrow(HttpException);

      mockModel.findOne.mockImplementation((query: { key: string }) => {
        if (query.key === "account:safe@example.com") {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      await expect(
        service.checkThrottle("192.168.1.1", "safe@example.com"),
      ).resolves.toBeUndefined();
    });

    it("should fail-open when the database throws an error", async () => {
      mockModel.findOne.mockRejectedValue(new Error("DB connection lost"));
      jest.spyOn(service["logger"], "warn").mockImplementation();

      await expect(
        service.checkThrottle("192.168.1.1", "test@example.com"),
      ).resolves.toBeUndefined();
    });
  });

  // --- recordFailure ---

  describe("recordFailure", () => {
    it("should upsert both IP and account failure counters", async () => {
      await service.recordFailure("192.168.1.1", "test@example.com");

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { key: "ip:192.168.1.1" },
        expect.objectContaining({ $inc: { failureCount: 1 } }),
        expect.objectContaining({ upsert: true }),
      );
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { key: "account:test@example.com" },
        expect.objectContaining({ $inc: { failureCount: 1 } }),
        expect.objectContaining({ upsert: true }),
      );
    });

    it("should not throw when the database fails to record", async () => {
      mockModel.findOneAndUpdate.mockRejectedValue(new Error("DB error"));
      jest.spyOn(service["logger"], "warn").mockImplementation();

      await expect(
        service.recordFailure("192.168.1.1", "test@example.com"),
      ).resolves.toBeUndefined();
    });
  });

  // --- recordSuccess ---

  describe("recordSuccess", () => {
    it("should delete both IP and account counters on success", async () => {
      await service.recordSuccess("192.168.1.1", "test@example.com");

      expect(mockModel.deleteOne).toHaveBeenCalledTimes(2);
      expect(mockModel.deleteOne).toHaveBeenCalledWith({
        key: "ip:192.168.1.1",
      });
      expect(mockModel.deleteOne).toHaveBeenCalledWith({
        key: "account:test@example.com",
      });
    });

    it("should not throw when the database fails to clear", async () => {
      mockModel.deleteOne.mockRejectedValue(new Error("DB error"));
      jest.spyOn(service["logger"], "warn").mockImplementation();

      await expect(
        service.recordSuccess("192.168.1.1", "test@example.com"),
      ).resolves.toBeUndefined();
    });
  });
});
