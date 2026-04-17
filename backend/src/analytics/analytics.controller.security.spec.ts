/**
 * Unit tests for the security-events endpoint on AnalyticsController.
 * Split out from the main controller spec to keep each file under the
 * 200-line limit and to isolate the staff-feed concerns from the
 * dashboard analytics concerns.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { AnalyticsController } from "./analytics.controller";
import { OverviewAnalyticsService } from "./overview-analytics.service";
import { ClinicAnalyticsService } from "./clinic-analytics.service";
import { AnalyticsService } from "./analytics.service";

const mockEvents = [
  {
    eventType: "rate_limit_exceeded",
    ip: "192.168.1.1",
    endpoint: "/conversations",
    createdAt: new Date(),
  },
];

describe("AnalyticsController (security events)", () => {
  let controller: AnalyticsController;
  let analyticsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    analyticsService = {
      getSecurityEvents: jest.fn().mockResolvedValue(mockEvents),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: OverviewAnalyticsService, useValue: { getOverview: jest.fn(), getClinicComparison: jest.fn() } },
        { provide: ClinicAnalyticsService, useValue: { getClinicAnalytics: jest.fn() } },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it("should return security events", async () => {
    const result = await controller.getSecurityEvents();
    expect(result).toEqual(mockEvents);
  });

  it("should pass eventType filter to service", async () => {
    await controller.getSecurityEvents("login_failed");

    expect(analyticsService.getSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "login_failed" }),
    );
  });

  it("should pass IP filter to service", async () => {
    await controller.getSecurityEvents(undefined, "10.0.0.1");

    expect(analyticsService.getSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "10.0.0.1" }),
    );
  });

  it("should parse date range strings into Date objects", async () => {
    await controller.getSecurityEvents(
      undefined, undefined, undefined, "2026-01-01", "2026-12-31",
    );

    expect(analyticsService.getSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) }),
    );
  });

  it("should parse the limit param as an integer", async () => {
    await controller.getSecurityEvents(
      undefined, undefined, undefined, undefined, undefined, "25",
    );

    expect(analyticsService.getSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("should return an empty array when no events match", async () => {
    analyticsService.getSecurityEvents.mockResolvedValue([]);
    const result = await controller.getSecurityEvents("nonexistent");
    expect(result).toEqual([]);
  });
});
