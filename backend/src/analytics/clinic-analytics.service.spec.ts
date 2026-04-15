import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { ClinicAnalyticsService } from './clinic-analytics.service';
import { Conversation } from '../database/schemas/conversation.schema';
import { Lead } from '../database/schemas/lead.schema';

const VALID_ID = '507f1f77bcf86cd799439011';

/** Helper to create a mock Mongoose model. */
const createMockModel = () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([]),
});

/**
 * Unit tests for ClinicAnalyticsService.
 * Conversations are the single source of truth for leads and bookings.
 */
describe('ClinicAnalyticsService', () => {
  let service: ClinicAnalyticsService;
  let conversationModel: ReturnType<typeof createMockModel>;
  let leadModel: ReturnType<typeof createMockModel>;

  beforeEach(async () => {
    conversationModel = createMockModel();
    leadModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicAnalyticsService,
        { provide: getModelToken(Conversation.name), useValue: conversationModel },
        { provide: getModelToken(Lead.name), useValue: leadModel },
      ],
    }).compile();

    service = module.get<ClinicAnalyticsService>(ClinicAnalyticsService);
  });

  describe('getClinicAnalytics', () => {
    beforeEach(() => {
      // Default: funnel returns empty facets, phase/source aggregations return empty
      conversationModel.aggregate.mockResolvedValue([{
        leads: [], qualified: [], bookingStarted: [], booked: [],
      }]);
    });

    it('should throw BadRequestException for invalid clinic ID', async () => {
      await expect(service.getClinicAnalytics('bad-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for short hex string', async () => {
      await expect(service.getClinicAnalytics('abc123')).rejects.toThrow(BadRequestException);
    });

    it('should return zeroed metrics for a clinic with no data', async () => {
      conversationModel.aggregate
        .mockResolvedValueOnce([])   // bookingsOverTime
        .mockResolvedValueOnce([{ leads: [], qualified: [], bookingStarted: [], booked: [] }]) // funnel
        .mockResolvedValueOnce([])   // phase distribution
        .mockResolvedValueOnce([]);  // avg messages

      const result = await service.getClinicAnalytics(VALID_ID);

      expect(result.leads).toBe(0);
      expect(result.bookings).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.funnel).toEqual({ leads: 0, qualified: 0, bookingStarted: 0, booked: 0 });
      expect(result.declineRate).toBe(0);
      expect(result.avgMessagesToBooking).toBe(0);
    });

    it('should calculate conversion rate from conversations', async () => {
      // Leads and bookings now come from conversationModel.countDocuments
      conversationModel.countDocuments
        .mockResolvedValueOnce(100)  // leads (all conversations)
        .mockResolvedValueOnce(45);  // bookings (booked phase conversations)
      conversationModel.aggregate
        .mockResolvedValueOnce([])   // bookingsOverTime
        .mockResolvedValueOnce([{    // funnel
          leads: [{ count: 100 }], qualified: [{ count: 80 }],
          bookingStarted: [{ count: 60 }], booked: [{ count: 45 }],
        }])
        .mockResolvedValueOnce([{ phase: 'confirmed', count: 40 }, { phase: 'declined', count: 5 }]) // phases
        .mockResolvedValueOnce([{ _id: null, avg: 8 }]); // avgMessages

      const result = await service.getClinicAnalytics(VALID_ID);

      expect(result.leads).toBe(100);
      expect(result.bookings).toBe(45);
      expect(result.conversionRate).toBe(45);
      expect(result.funnel.qualified).toBe(80);
      expect(result.funnel.bookingStarted).toBe(60);
    });

    it('should compute decline rate from phase distribution', async () => {
      conversationModel.countDocuments
        .mockResolvedValueOnce(50)   // leads
        .mockResolvedValueOnce(0);   // bookings
      conversationModel.aggregate
        .mockResolvedValueOnce([])   // bookingsOverTime
        .mockResolvedValueOnce([{ leads: [{ count: 50 }], qualified: [], bookingStarted: [], booked: [] }])
        .mockResolvedValueOnce([{ phase: 'declined', count: 10 }, { phase: 'greeting', count: 40 }])
        .mockResolvedValueOnce([]);

      const result = await service.getClinicAnalytics(VALID_ID);

      expect(result.declineRate).toBe(20); // 10/50 * 100
    });

    it('should return lead source distribution with percentages', async () => {
      leadModel.aggregate.mockResolvedValue([
        { _id: 'facebook', count: 30 },
        { _id: 'google_ads', count: 20 },
      ]);
      conversationModel.aggregate
        .mockResolvedValueOnce([])   // bookingsOverTime
        .mockResolvedValueOnce([{ leads: [], qualified: [], bookingStarted: [], booked: [] }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getClinicAnalytics(VALID_ID);

      expect(result.leadSources).toHaveLength(2);
      expect(result.leadSources[0].source).toBe('facebook');
      expect(result.leadSources[0].percentage).toBe(60); // 30/50 * 100
      expect(result.leadSources[1].percentage).toBe(40); // 20/50 * 100
    });

    it('should handle null lead source as unknown', async () => {
      leadModel.aggregate.mockResolvedValue([{ _id: null, count: 5 }]);
      conversationModel.aggregate
        .mockResolvedValueOnce([])   // bookingsOverTime
        .mockResolvedValueOnce([{ leads: [], qualified: [], bookingStarted: [], booked: [] }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getClinicAnalytics(VALID_ID);

      expect(result.leadSources[0].source).toBe('unknown');
    });

    it('should return average messages to booking', async () => {
      conversationModel.aggregate
        .mockResolvedValueOnce([])   // bookingsOverTime
        .mockResolvedValueOnce([{ leads: [], qualified: [], bookingStarted: [], booked: [] }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ _id: null, avg: 8.3 }]);

      const result = await service.getClinicAnalytics(VALID_ID);

      expect(result.avgMessagesToBooking).toBe(8); // Rounded
    });

    it('should use custom date range when provided', async () => {
      conversationModel.aggregate
        .mockResolvedValueOnce([])   // bookingsOverTime
        .mockResolvedValueOnce([{ leads: [], qualified: [], bookingStarted: [], booked: [] }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getClinicAnalytics(VALID_ID, '2026-03-01', '2026-03-15');

      expect(result).toBeDefined();
      expect(conversationModel.countDocuments).toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      conversationModel.countDocuments.mockRejectedValue(new Error('Connection lost'));

      await expect(service.getClinicAnalytics(VALID_ID)).rejects.toThrow('Connection lost');
    });
  });
});
