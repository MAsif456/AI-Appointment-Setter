import { Test, TestingModule } from "@nestjs/testing";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsController", () => {
  let controller: AnalyticsController;
  let mockService: Record<string, jest.Mock>;

  const mockEvents = [
    {
      eventType: "rate_limit_exceeded",
      ip: "192.168.1.1",
      endpoint: "/conversations",
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    mockService = {
      getSecurityEvents: jest.fn().mockResolvedValue(mockEvents),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockService }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it("should return security events", async () => {
    const result = await controller.getSecurityEvents();
    expect(result).toEqual(mockEvents);
  });

  it("should pass eventType filter to service", async () => {
    await controller.getSecurityEvents("login_failed");

    expect(mockService.getSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "login_failed" }),
    );
  });

  it("should pass IP filter to service", async () => {
    await controller.getSecurityEvents(undefined, "10.0.0.1");

    expect(mockService.getSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "10.0.0.1" }),
    );
  });

  it("should parse date range strings into Date objects", async () => {
    await controller.getSecurityEvents(
      undefined,
      undefined,
      undefined,
      "2026-01-01",
      "2026-12-31",
    );

    expect(mockService.getSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    );
  });

  it("should parse limit as integer", async () => {
    await controller.getSecurityEvents(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "25",
    );

    expect(mockService.getSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("should return empty array when no events match", async () => {
    mockService.getSecurityEvents.mockResolvedValue([]);
    const result = await controller.getSecurityEvents("nonexistent");
    expect(result).toEqual([]);
  });
});
