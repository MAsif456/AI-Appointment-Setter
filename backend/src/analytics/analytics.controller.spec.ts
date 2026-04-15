/**
 * Unit tests for AnalyticsController (dashboard endpoints).
 * Security-event cases live in analytics.controller.security.spec.ts
 * to keep this file under the 200-line limit and to separate the two
 * concerns (dashboard analytics vs. staff security feed).
 */
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { OverviewAnalyticsService } from "./overview-analytics.service";
import { ClinicAnalyticsService } from "./clinic-analytics.service";
import { AnalyticsService } from "./analytics.service";

const mockOverview = {
  totalLeads: 50,
  totalBookings: 20,
  conversionRate: 40,
  avgMessagesToBooking: 6,
  comparison: {
    leadsChange: 10,
    bookingsChange: 5,
    conversionRateChange: 2,
    avgMessagesToBookingChange: -1,
  },
  bookingsOverTime: [{ date: "2026-03-20", count: 5 }],
  conversionFunnel: { leads: 50, qualified: 40, bookingStarted: 30, booked: 20 },
};

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

const mockClinicAnalytics = {
  leads: 30,
  bookings: 12,
  conversionRate: 40,
  bookingsOverTime: [{ date: "2026-03-20", count: 3 }],
  funnel: { leads: 30, qualified: 25, bookingStarted: 18, booked: 12 },
  conversationPhaseDistribution: [{ phase: "confirmed", count: 12 }],
  leadSources: [{ source: "facebook", count: 15, percentage: 50 }],
  avgMessagesToBooking: 8,
  declineRate: 3,
};

const STAFF_CLINIC = "507f1f77bcf86cd799439011";
const OTHER_CLINIC = "111111111111111111111111";

describe("AnalyticsController", () => {
  let controller: AnalyticsController;
  let overviewService: Record<string, jest.Mock>;
  let clinicService: Record<string, jest.Mock>;

  beforeEach(async () => {
    overviewService = {
      getOverview: jest.fn().mockResolvedValue(mockOverview),
      getClinicComparison: jest.fn().mockResolvedValue(mockComparison),
    };
    clinicService = {
      getClinicAnalytics: jest.fn().mockResolvedValue(mockClinicAnalytics),
    };
    // Security-event cases covered in analytics.controller.security.spec.ts;
    // a bare stub is enough to satisfy the controller's DI graph.
    const analyticsService = { getSecurityEvents: jest.fn() };

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
    it("calls service with default params", async () => {
      const result = await controller.getOverview({}, adminReq);
      expect(overviewService.getOverview).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
      expect(result).toEqual(mockOverview);
    });

    it("forwards period to service", async () => {
      await controller.getOverview({ period: "month" }, adminReq);
      expect(overviewService.getOverview).toHaveBeenCalledWith("month", undefined, undefined, undefined);
    });

    it("forwards custom date range to service", async () => {
      await controller.getOverview({ startDate: "2026-03-01", endDate: "2026-03-15" }, adminReq);
      expect(overviewService.getOverview).toHaveBeenCalledWith(undefined, "2026-03-01", "2026-03-15", undefined);
    });

    it("forces staff to their assigned clinics and ignores query override", async () => {
      await controller.getOverview({ clinicIds: "aaa,bbb" }, staffReq([STAFF_CLINIC]));
      expect(overviewService.getOverview).toHaveBeenCalledWith(undefined, undefined, undefined, STAFF_CLINIC);
    });

    it("propagates errors from the service", async () => {
      overviewService.getOverview.mockRejectedValue(new Error("DB error"));
      await expect(controller.getOverview({}, adminReq)).rejects.toThrow("DB error");
    });
  });

  describe("getClinicComparison", () => {
    it("returns comparison data", async () => {
      const result = await controller.getClinicComparison({}, adminReq);
      expect(overviewService.getClinicComparison).toHaveBeenCalled();
      expect(result).toEqual(mockComparison);
    });

    it("forwards period and custom range to the service", async () => {
      await controller.getClinicComparison(
        { period: "month", startDate: "2026-03-01", endDate: "2026-03-15" },
        adminReq,
      );
      expect(overviewService.getClinicComparison).toHaveBeenCalledWith(undefined, "month", "2026-03-01", "2026-03-15");
    });

    it("scopes staff users to their assigned clinics", async () => {
      await controller.getClinicComparison({}, staffReq([STAFF_CLINIC]));
      expect(overviewService.getClinicComparison).toHaveBeenCalledWith(STAFF_CLINIC, undefined, undefined, undefined);
    });

    it("returns empty array when no clinics exist", async () => {
      overviewService.getClinicComparison.mockResolvedValue([]);
      expect(await controller.getClinicComparison({}, adminReq)).toEqual([]);
    });

    it("propagates errors from the service", async () => {
      overviewService.getClinicComparison.mockRejectedValue(new Error("Aggregation failed"));
      await expect(controller.getClinicComparison({}, adminReq)).rejects.toThrow("Aggregation failed");
    });
  });

  describe("getClinicAnalytics", () => {
    it("calls clinicService with clinicId and empty query", async () => {
      const result = await controller.getClinicAnalytics(STAFF_CLINIC, {}, adminReq);
      expect(clinicService.getClinicAnalytics).toHaveBeenCalledWith(STAFF_CLINIC, undefined, undefined);
      expect(result).toEqual(mockClinicAnalytics);
    });

    it("passes custom date range to clinic service", async () => {
      await controller.getClinicAnalytics(
        STAFF_CLINIC,
        { startDate: "2026-03-01", endDate: "2026-03-15" },
        adminReq,
      );
      expect(clinicService.getClinicAnalytics).toHaveBeenCalledWith(STAFF_CLINIC, "2026-03-01", "2026-03-15");
    });

    it("rejects staff requesting a clinic they are not assigned to", () => {
      expect(() =>
        controller.getClinicAnalytics(STAFF_CLINIC, {}, staffReq([OTHER_CLINIC])),
      ).toThrow("You are not assigned to this clinic.");
    });

    it("allows staff requesting a clinic they are assigned to", async () => {
      await controller.getClinicAnalytics(STAFF_CLINIC, {}, staffReq([STAFF_CLINIC]));
      expect(clinicService.getClinicAnalytics).toHaveBeenCalled();
    });

    it("propagates BadRequestException for invalid clinic ID", async () => {
      clinicService.getClinicAnalytics.mockRejectedValue(new BadRequestException("Invalid clinic ID format"));
      await expect(controller.getClinicAnalytics("bad-id", {}, adminReq)).rejects.toThrow(BadRequestException);
    });

    it("propagates unexpected errors from the service", async () => {
      clinicService.getClinicAnalytics.mockRejectedValue(new Error("Connection lost"));
      await expect(controller.getClinicAnalytics(STAFF_CLINIC, {}, adminReq)).rejects.toThrow("Connection lost");
    });
  });
});
