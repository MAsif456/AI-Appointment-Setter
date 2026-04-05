import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let mockAuthService: Record<string, jest.Mock>;

  const mockRequest = {
    ip: "192.168.1.1",
    socket: { remoteAddress: "192.168.1.1" },
  } as any;

  beforeEach(async () => {
    mockAuthService = {
      login: jest.fn().mockResolvedValue({
        userId: "user-id-123",
        email: "admin@lunaxdigital.com",
        role: "admin",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should return user data on successful login", async () => {
    const result = await controller.login(
      { email: "admin@lunaxdigital.com", password: "admin123" },
      mockRequest,
    );

    expect(result).toEqual({
      userId: "user-id-123",
      email: "admin@lunaxdigital.com",
      role: "admin",
    });
  });

  it("should pass email, password, and IP to the auth service", async () => {
    await controller.login(
      { email: "admin@lunaxdigital.com", password: "admin123" },
      mockRequest,
    );

    expect(mockAuthService.login).toHaveBeenCalledWith(
      { email: "admin@lunaxdigital.com", password: "admin123" },
      "192.168.1.1",
    );
  });

  it("should propagate 401 from auth service", async () => {
    mockAuthService.login.mockRejectedValue(
      new HttpException("Invalid credentials", HttpStatus.UNAUTHORIZED),
    );

    await expect(
      controller.login(
        { email: "wrong@example.com", password: "wrong" },
        mockRequest,
      ),
    ).rejects.toThrow("Invalid credentials");
  });

  it("should propagate 429 from auth service", async () => {
    mockAuthService.login.mockRejectedValue(
      new HttpException(
        "Too many login attempts. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    try {
      await controller.login(
        { email: "admin@lunaxdigital.com", password: "admin123" },
        mockRequest,
      );
      fail("Should have thrown");
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it("should extract IP from req.socket.remoteAddress as fallback", async () => {
    const reqNoIp = { socket: { remoteAddress: "10.0.0.5" } } as any;

    await controller.login(
      { email: "admin@lunaxdigital.com", password: "admin123" },
      reqNoIp,
    );

    expect(mockAuthService.login).toHaveBeenCalledWith(
      expect.anything(),
      "10.0.0.5",
    );
  });
});
