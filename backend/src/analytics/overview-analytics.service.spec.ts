/**
 * Unit tests for OverviewAnalyticsService.
 * Conversations are the single source of truth for leads, bookings and
 * the new "average messages to booking" metric.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { OverviewAnalyticsService } from './overview-analytics.service';
import { Clinic } from '../database/schemas/clinic.schema';
import { Conversation } from '../database/schemas/conversation.schema';

/** Mock Mongoose model with the methods the service uses. */
const createMockModel = () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([]),
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  }),
});

/** Default empty $facet result returned by the funnel aggregation. */
const EMPTY_FUNNEL = { leads: [], qualified: [], bookingStarted: [], booked: [] };

// Aggregate call order: current avgMsgs, previous avgMsgs, bookingsOverTime, funnel.
const orderedAggregates = (
  agg: jest.Mock,
  current: unknown[],
  previous: unknown[],
  bookings: unknown[],
  funnel: unknown[],
) =>
  agg
    .mockResolvedValueOnce(current)
    .mockResolvedValueOnce(previous)
    .mockResolvedValueOnce(bookings)
    .mockResolvedValueOnce(funnel);

describe('OverviewAnalyticsService', () => {
  let service: OverviewAnalyticsService;
  let conversationModel: ReturnType<typeof createMockModel>;
  let clinicModel: ReturnType<typeof createMockModel>;

  beforeEach(async () => {
    conversationModel = createMockModel();
    clinicModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverviewAnalyticsService,
        { provide: getModelToken(Conversation.name), useValue: conversationModel },
        { provide: getModelToken(Clinic.name), useValue: clinicModel },
      ],
    }).compile();

    service = module.get<OverviewAnalyticsService>(OverviewAnalyticsService);
  });

  describe('getOverview', () => {
    it('should return zeroed metrics when no data exists', async () => {
      orderedAggregates(conversationModel.aggregate, [], [], [], [EMPTY_FUNNEL]);

      const result = await service.getOverview('week');

      expect(result.totalLeads).toBe(0);
      expect(result.totalBookings).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.avgMessagesToBooking).toBe(0);
      expect(result.conversionFunnel).toEqual({ leads: 0, qualified: 0, bookingStarted: 0, booked: 0 });
    });

    it('should calculate conversion rate and funnel from conversations', async () => {
      conversationModel.countDocuments
        .mockResolvedValueOnce(100).mockResolvedValueOnce(45) // current leads/bookings
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0);   // previous leads/bookings
      orderedAggregates(conversationModel.aggregate, [], [], [], [
        {
          leads: [{ count: 100 }], qualified: [{ count: 80 }],
          bookingStarted: [{ count: 60 }], booked: [{ count: 45 }],
        },
      ]);

      const result = await service.getOverview('week');

      expect(result.totalLeads).toBe(100);
      expect(result.totalBookings).toBe(45);
      expect(result.conversionRate).toBe(45);
      expect(result.conversionFunnel.leads).toBe(100);
      expect(result.conversionFunnel.booked).toBe(45);
    });

    it('should include average messages to booking from booked conversations', async () => {
      orderedAggregates(
        conversationModel.aggregate,
        [{ _id: null, avg: 6.5 }], [], [], [EMPTY_FUNNEL],
      );

      const result = await service.getOverview('week');

      expect(result.avgMessagesToBooking).toBe(7); // rounded from 6.5
    });

    it('should compute comparison percentages against the previous period', async () => {
      conversationModel.countDocuments
        .mockResolvedValueOnce(100).mockResolvedValueOnce(50)
        .mockResolvedValueOnce(80).mockResolvedValueOnce(40);
      orderedAggregates(
        conversationModel.aggregate,
        [{ _id: null, avg: 5 }], [{ _id: null, avg: 10 }], [], [EMPTY_FUNNEL],
      );

      const result = await service.getOverview('week');

      expect(result.comparison.leadsChange).toBe(25);
      expect(result.comparison.bookingsChange).toBe(25);
      expect(result.comparison.avgMessagesToBookingChange).toBe(-50);
    });

    it('should return zero comparison when the previous period has no data', async () => {
      conversationModel.countDocuments
        .mockResolvedValueOnce(50).mockResolvedValueOnce(20)
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      conversationModel.aggregate.mockResolvedValue([EMPTY_FUNNEL]);

      const result = await service.getOverview('week');

      expect(result.comparison.leadsChange).toBe(0);
      expect(result.comparison.bookingsChange).toBe(0);
    });

    it('should honour a custom date range when provided', async () => {
      conversationModel.aggregate.mockResolvedValue([EMPTY_FUNNEL]);

      await service.getOverview('week', '2026-03-01', '2026-03-15');

      expect(conversationModel.countDocuments).toHaveBeenCalled();
    });

    it('should issue exactly four countDocuments (current + previous × leads + bookings)', async () => {
      conversationModel.aggregate.mockResolvedValue([EMPTY_FUNNEL]);

      await service.getOverview('month');

      expect(conversationModel.countDocuments).toHaveBeenCalledTimes(4);
    });

    it('should return bookings-over-time data from conversations', async () => {
      const timeData = [
        { date: '2026-03-20', count: 5 },
        { date: '2026-03-21', count: 3 },
      ];
      orderedAggregates(conversationModel.aggregate, [], [], timeData, [EMPTY_FUNNEL]);

      const result = await service.getOverview('week');

      expect(result.bookingsOverTime).toEqual(timeData);
    });
  });

  describe('getClinicComparison', () => {
    it('should return formatted clinic comparison rows', async () => {
      conversationModel.aggregate.mockResolvedValue([
        {
          _id: 'clinic1', clinic: { name: 'Cardiff Physio' },
          leads: 50, booked: 20, declined: 5, totalMessages: 350,
        },
      ]);

      const result = await service.getClinicComparison();

      expect(result).toHaveLength(1);
      expect(result[0].clinicName).toBe('Cardiff Physio');
      expect(result[0].conversionRate).toBe(40); // 20/50 * 100
      expect(result[0].avgMessages).toBe(7); // 350/50
      expect(result[0].declineRate).toBe(10); // 5/50 * 100
    });

    it('should return an empty array when no clinics have conversations', async () => {
      conversationModel.aggregate.mockResolvedValue([]);

      expect(await service.getClinicComparison()).toEqual([]);
    });

    it('should handle a clinic with zero leads gracefully', async () => {
      conversationModel.aggregate.mockResolvedValue([
        {
          _id: 'clinic1', clinic: { name: 'Empty Clinic' },
          leads: 0, booked: 0, declined: 0, totalMessages: 0,
        },
      ]);

      const result = await service.getClinicComparison();

      expect(result[0].conversionRate).toBe(0);
      expect(result[0].avgMessages).toBe(0);
      expect(result[0].declineRate).toBe(0);
    });
  });
});
