import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { OverviewAnalyticsService } from "./overview-analytics.service";
import { ClinicAnalyticsService } from "./clinic-analytics.service";
import { AnalyticsService } from "./analytics.service";

/** Mock overview response for assertions. */
const mockOverview = {
  totalLeads: 50,
  totalBookings: 20,
  conversionRate: 40,
  avgResponseTime: 6,
  comparison: {
    leadsChange: 10,
    bookingsChange: 5,
    conversionRateChange: 2,
    avgResponseTimeChange: -1,
  },
  bookingsOverTime: [{ date: "2026-03-20", count: 5 }],
  conversionFunnel: { leads: 50, qualified: 40, bookingStarted: 30, booked: 20 },
};

/** Mock clinic comparison rows. */
const mockComparison = [
  {
    clinicId: "abc123",
    clinicName: "Cardiff Physio",
    leads: 30,
    bookings: 12,
    conversionRate: 40,
    avgMessages: 7,
    declineRate: 5,
  },
];

/** Mock clinic analytics response. */
const mockClinicAnalytics = {
  leads: 30,
  bookings: 12,
  conversionRate: 40,
  avgResponseTime: 5,
  bookingsOverTime: [{ date: "2026-03-20", count: 3 }],
  funnel: { leads: 30, qualified: 25, bookingStarted: 18, booked: 12 },
  conversationPhaseDistribution: [{ phase: "confirmed", count: 12 }],
  leadSources: [{ source: "facebook", count: 15, percentage: 50 }],
  avgMessagesToBooking: 8,
  declineRate: 3,
};

/** Mock security events payload. */
const mockEvents = [
  {
    eventType: "rate_limit_exceeded",
    ip: "192.168.1.1",
    endpoint: "/conversations",
    createdAt: new Date(),
  },
];

/**
 * Unit tests for AnalyticsController.
 * Mocks all three service layers and tests HTTP-level behaviour.
 */
describe("AnalyticsController", () => {
  let controller: AnalyticsController;
  let overviewService: Record<string, jest.Mock>;
  let clinicService: Record<string, jest.Mock>;
  let analyticsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    overviewService = {
      getOverview: jest.fn().mockResolvedValue(mockOverview),
      getClinicComparison: jest.fn().mockResolvedValue(mockComparison),
    };
    clinicService = {
      getClinicAnalytics: jest.fn().mockResolvedValue(mockClinicAnalytics),
    };
    analyticsService = {
      getSecurityEvents: jest.fn().mockResolvedValue(mockEvents),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: OverviewAnalyticsService, useValue: overviewService },
        { provide: ClinicAnalyticsService, useValue: clinicService },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  const adminReq = { user: { role: "admin", assignedClinics: [] } } as any;
  const staffReq = (ids: string[]) =>
    ({ user: { role: "staff", assignedClinics: ids } }) as any;

  describe("getOverview", () => {
    it("should call overviewService.getOverview with default params", async () => {
      const result = await controller.getOverview({}, adminReq);

      expect(overviewService.getOverview).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockOverview);
    });

    it("should pass period query param to service", async () => {
      await controller.getOverview({ period: "month" }, adminReq);

      expect(overviewService.getOverview).toHaveBeenCalledWith(
        "month",
        undefined,
        undefined,
        undefined,
      );
    });

    it("should pass custom date range to service", async () => {
      await controller.getOverview(
        {
          startDate: "2026-03-01",
          endDate: "2026-03-15",
        },
        adminReq,
      );

      expect(overviewService.getOverview).toHaveBeenCalledWith(
        undefined,
        "2026-03-01",
        "2026-03-15",
        undefined,
      );
    });

    it("should force staff to their assigned clinics and ignore query override", async () => {
      await controller.getOverview(
        { clinicIds: "aaa,bbb" },
        staffReq(["507f1f77bcf86cd799439011"]),
      );

      expect(overviewService.getOverview).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        "507f1f77bcf86cd799439011",
      );
    });

    it("should propagate errors from the service", async () => {
      overviewService.getOverview.mockRejectedValue(new Error("DB error"));

      await expect(controller.getOverview({}, adminReq)).rejects.toThrow("DB error");
    });
  });

  describe("getClinicComparison", () => {
    it("should return clinic comparison data", async () => {
      const result = await controller.getClinicComparison({}, adminReq);

      expect(overviewService.getClinicComparison).toHaveBeenCalled();
      expect(result).toEqual(mockComparison);
    });

    it("should forward period and custom range to the service", async () => {
      await controller.getClinicComparison(
        { period: "month", startDate: "2026-03-01", endDate: "2026-03-15" },
        adminReq,
      );

      expect(overviewService.getClinicComparison).toHaveBeenCalledWith(
        undefined,
        "month",
        "2026-03-01",
        "2026-03-15",
      );
    });

    it("should scope staff users to their assigned clinics", async () => {
      await controller.getClinicComparison(
        {},
        staffReq(["507f1f77bcf86cd799439011"]),
      );

      expect(overviewService.getClinicComparison).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        undefined,
        undefined,
        undefined,
      );
    });

    it("should return empty array when no clinics exist", async () => {
      overviewService.getClinicComparison.mockResolvedValue([]);

      const result = await controller.getClinicComparison({}, adminReq);

      expect(result).toEqual([]);
    });

    it("should propagate errors from the service", async () => {
      overviewService.getClinicComparison.mockRejectedValue(
        new Error("Aggregation failed"),
      );

      await expect(
        controller.getClinicComparison({}, adminReq),
      ).rejects.toThrow("Aggregation failed");
    });
  });

  describe("getClinicAnalytics", () => {
    it("should call clinicService with clinicId and empty query", async () => {
      const result = await controller.getClinicAnalytics(
        "507f1f77bcf86cd799439011",
        {},
        adminReq,
      );

      expect(clinicService.getClinicAnalytics).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        undefined,
        undefined,
      );
      expect(result).toEqual(mockClinicAnalytics);
    });

    it("should pass custom date range to clinic service", async () => {
      await controller.getClinicAnalytics(
        "507f1f77bcf86cd799439011",
        {
          startDate: "2026-03-01",
          endDate: "2026-03-15",
        },
        adminReq,
      );

      expect(clinicService.getClinicAnalytics).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "2026-03-01",
        "2026-03-15",
      );
    });

    it("should reject staff requesting a clinic they are not assigned to", async () => {
      expect(() =>
        controller.getClinicAnalytics(
          "507f1f77bcf86cd799439011",
          {},
          staffReq(["111111111111111111111111"]),
        ),
      ).toThrow("You are not assigned to this clinic.");
    });

    it("should allow staff requesting a clinic they are assigned to", async () => {
      await controller.getClinicAnalytics(
        "507f1f77bcf86cd799439011",
        {},
        staffReq(["507f1f77bcf86cd799439011"]),
      );
      expect(clinicService.getClinicAnalytics).toHaveBeenCalled();
    });

    it("should propagate BadRequestException for invalid clinic ID", async () => {
      clinicService.getClinicAnalytics.mockRejectedValue(
        new BadRequestException("Invalid clinic ID format"),
      );

      await expect(
        controller.getClinicAnalytics("bad-id", {}, adminReq),
      ).rejects.toThrow(BadRequestException);
    });

    it("should propagate unexpected errors from the service", async () => {
      clinicService.getClinicAnalytics.mockRejectedValue(
        new Error("Connection lost"),
      );

      await expect(
        controller.getClinicAnalytics("507f1f77bcf86cd799439011", {}, adminReq),
      ).rejects.toThrow("Connection lost");
    });
  });

  describe("getSecurityEvents", () => {
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
        undefined,
        undefined,
        undefined,
        "2026-01-01",
        "2026-12-31",
      );

      expect(analyticsService.getSecurityEvents).toHaveBeenCalledWith(
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

      expect(analyticsService.getSecurityEvents).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 }),
      );
    });

    it("should return empty array when no events match", async () => {
      analyticsService.getSecurityEvents.mockResolvedValue([]);
      const result = await controller.getSecurityEvents("nonexistent");
      expect(result).toEqual([]);
    });
  });
});
