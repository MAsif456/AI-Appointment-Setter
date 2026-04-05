import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { AuthService } from "./auth.service";
import { AuthThrottleService } from "./auth-throttle.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { User } from "../database/schemas/user.schema";
import * as bcrypt from "bcrypt";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let mockUserModel: Record<string, jest.Mock>;
  let mockThrottle: Record<string, jest.Mock>;
  let mockAnalyticsService: Record<string, jest.Mock>;

  const mockUser = {
    _id: { toString: () => "user-id-123" },
    email: "admin@lunaxdigital.com",
    passwordHash: "$2b$10$hashedpassword",
    role: "admin",
    isActive: true,
  };

  beforeEach(async () => {
    mockUserModel = {
      findOne: jest.fn().mockResolvedValue(mockUser),
      updateOne: jest.fn().mockResolvedValue({}),
    };

    mockThrottle = {
      checkThrottle: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(undefined),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
    };

    mockAnalyticsService = {
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
    };

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: AuthThrottleService, useValue: mockThrottle },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should return userId, email, and role on successful login", async () => {
    const result = await service.login(
      { email: "admin@lunaxdigital.com", password: "admin123" },
      "192.168.1.1",
    );

    expect(result).toEqual({
      userId: "user-id-123",
      email: "admin@lunaxdigital.com",
      role: "admin",
    });
  });

  it("should check throttle before validating credentials", async () => {
    await service.login(
      { email: "admin@lunaxdigital.com", password: "admin123" },
      "192.168.1.1",
    );

    expect(mockThrottle.checkThrottle).toHaveBeenCalledWith(
      "192.168.1.1",
      "admin@lunaxdigital.com",
    );
  });

  it("should call recordSuccess and update lastLoginAt on success", async () => {
    await service.login(
      { email: "admin@lunaxdigital.com", password: "admin123" },
      "192.168.1.1",
    );

    expect(mockThrottle.recordSuccess).toHaveBeenCalledWith(
      "192.168.1.1",
      "admin@lunaxdigital.com",
    );
    expect(mockUserModel.updateOne).toHaveBeenCalledWith(
      { _id: mockUser._id },
      expect.objectContaining({ lastLoginAt: expect.any(Date) }),
    );
  });

  it("should throw generic error for unknown email", async () => {
    mockUserModel.findOne.mockResolvedValue(null);

    await expect(
      service.login(
        { email: "unknown@example.com", password: "password" },
        "192.168.1.1",
      ),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login(
        { email: "unknown@example.com", password: "password" },
        "192.168.1.1",
      ),
    ).rejects.toThrow("Invalid credentials");
  });

  it("should record failure for unknown email", async () => {
    mockUserModel.findOne.mockResolvedValue(null);

    try {
      await service.login(
        { email: "unknown@example.com", password: "password" },
        "192.168.1.1",
      );
    } catch {
      // expected
    }

    expect(mockThrottle.recordFailure).toHaveBeenCalledWith(
      "192.168.1.1",
      "unknown@example.com",
    );
  });

  it("should throw generic error for inactive account", async () => {
    mockUserModel.findOne.mockResolvedValue({ ...mockUser, isActive: false });

    await expect(
      service.login(
        { email: "admin@lunaxdigital.com", password: "admin123" },
        "192.168.1.1",
      ),
    ).rejects.toThrow("Invalid credentials");
  });

  it("should throw generic error for wrong password", async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login(
        { email: "admin@lunaxdigital.com", password: "wrongpass" },
        "192.168.1.1",
      ),
    ).rejects.toThrow("Invalid credentials");
  });

  it("should record failure for wrong password", async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    try {
      await service.login(
        { email: "admin@lunaxdigital.com", password: "wrongpass" },
        "192.168.1.1",
      );
    } catch {
      // expected
    }

    expect(mockThrottle.recordFailure).toHaveBeenCalledWith(
      "192.168.1.1",
      "admin@lunaxdigital.com",
    );
  });

  it("should propagate throttle exceptions (429)", async () => {
    const { HttpException, HttpStatus } = require("@nestjs/common");
    mockThrottle.checkThrottle.mockRejectedValue(
      new HttpException(
        "Too many login attempts. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    await expect(
      service.login(
        { email: "admin@lunaxdigital.com", password: "admin123" },
        "192.168.1.1",
      ),
    ).rejects.toThrow("Too many login attempts");
  });
});
