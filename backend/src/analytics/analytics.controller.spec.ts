import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { OverviewAnalyticsService } from './overview-analytics.service';
import { ClinicAnalyticsService } from './clinic-analytics.service';

/** Mock overview response for assertions. */
const mockOverview = {
  totalLeads: 50,
  totalBookings: 20,
  conversionRate: 40,
  avgResponseTime: 6,
  comparison: { leadsChange: 10, bookingsChange: 5, conversionRateChange: 2, avgResponseTimeChange: -1 },
  bookingsOverTime: [{ date: '2026-03-20', count: 5 }],
  conversionFunnel: { leads: 50, qualified: 40, bookingStarted: 30, booked: 20 },
};

/** Mock clinic comparison rows. */
const mockComparison = [
  { clinicId: 'abc123', clinicName: 'Cardiff Physio', leads: 30, bookings: 12, conversionRate: 40, avgMessages: 7, declineRate: 5 },
];

/** Mock clinic analytics response. */
const mockClinicAnalytics = {
  leads: 30, bookings: 12, conversionRate: 40, avgResponseTime: 5,
  bookingsOverTime: [{ date: '2026-03-20', count: 3 }],
  funnel: { leads: 30, qualified: 25, bookingStarted: 18, booked: 12 },
  conversationPhaseDistribution: [{ phase: 'confirmed', count: 12 }],
  leadSources: [{ source: 'facebook', count: 15, percentage: 50 }],
  avgMessagesToBooking: 8, declineRate: 3,
};

/**
 * Unit tests for AnalyticsController.
 * Mocks both service layers and tests HTTP-level behaviour.
 */
describe('AnalyticsController', () => {
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: OverviewAnalyticsService, useValue: overviewService },
        { provide: ClinicAnalyticsService, useValue: clinicService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  describe('getOverview', () => {
    it('should call overviewService.getOverview with default params', async () => {
      const result = await controller.getOverview({});

      expect(overviewService.getOverview).toHaveBeenCalledWith(undefined, undefined, undefined);
      expect(result).toEqual(mockOverview);
    });

    it('should pass period query param to service', async () => {
      await controller.getOverview({ period: 'month' });

      expect(overviewService.getOverview).toHaveBeenCalledWith('month', undefined, undefined);
    });

    it('should pass custom date range to service', async () => {
      await controller.getOverview({ startDate: '2026-03-01', endDate: '2026-03-15' });

      expect(overviewService.getOverview).toHaveBeenCalledWith(undefined, '2026-03-01', '2026-03-15');
    });

    it('should propagate errors from the service', async () => {
      overviewService.getOverview.mockRejectedValue(new Error('DB error'));

      await expect(controller.getOverview({})).rejects.toThrow('DB error');
    });
  });

  describe('getClinicComparison', () => {
    it('should return clinic comparison data', async () => {
      const result = await controller.getClinicComparison();

      expect(overviewService.getClinicComparison).toHaveBeenCalled();
      expect(result).toEqual(mockComparison);
    });

    it('should return empty array when no clinics exist', async () => {
      overviewService.getClinicComparison.mockResolvedValue([]);

      const result = await controller.getClinicComparison();

      expect(result).toEqual([]);
    });

    it('should propagate errors from the service', async () => {
      overviewService.getClinicComparison.mockRejectedValue(new Error('Aggregation failed'));

      await expect(controller.getClinicComparison()).rejects.toThrow('Aggregation failed');
    });
  });

  describe('getClinicAnalytics', () => {
    it('should call clinicService with clinicId and empty query', async () => {
      const result = await controller.getClinicAnalytics('507f1f77bcf86cd799439011', {});

      expect(clinicService.getClinicAnalytics).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011', undefined, undefined,
      );
      expect(result).toEqual(mockClinicAnalytics);
    });

    it('should pass custom date range to clinic service', async () => {
      await controller.getClinicAnalytics('507f1f77bcf86cd799439011', {
        startDate: '2026-03-01', endDate: '2026-03-15',
      });

      expect(clinicService.getClinicAnalytics).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011', '2026-03-01', '2026-03-15',
      );
    });

    it('should propagate BadRequestException for invalid clinic ID', async () => {
      clinicService.getClinicAnalytics.mockRejectedValue(
        new BadRequestException('Invalid clinic ID format'),
      );

      await expect(
        controller.getClinicAnalytics('bad-id', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate unexpected errors from the service', async () => {
      clinicService.getClinicAnalytics.mockRejectedValue(new Error('Connection lost'));

      await expect(
        controller.getClinicAnalytics('507f1f77bcf86cd799439011', {}),
      ).rejects.toThrow('Connection lost');
    });
  });
});
