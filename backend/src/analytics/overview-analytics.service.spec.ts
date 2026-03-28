import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { OverviewAnalyticsService } from './overview-analytics.service';
import { Conversation } from '../database/schemas/conversation.schema';
import { Lead } from '../database/schemas/lead.schema';
import { Appointment } from '../database/schemas/appointment.schema';
import { Message } from '../database/schemas/message.schema';

/** Helper to create a mock Mongoose model with common methods. */
const createMockModel = () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([]),
});

/**
 * Unit tests for OverviewAnalyticsService.
 * Mocks all Mongoose models and tests aggregation logic.
 */
describe('OverviewAnalyticsService', () => {
  let service: OverviewAnalyticsService;
  let conversationModel: ReturnType<typeof createMockModel>;
  let leadModel: ReturnType<typeof createMockModel>;
  let appointmentModel: ReturnType<typeof createMockModel>;
  let messageModel: ReturnType<typeof createMockModel>;

  beforeEach(async () => {
    conversationModel = createMockModel();
    leadModel = createMockModel();
    appointmentModel = createMockModel();
    messageModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverviewAnalyticsService,
        { provide: getModelToken(Conversation.name), useValue: conversationModel },
        { provide: getModelToken(Lead.name), useValue: leadModel },
        { provide: getModelToken(Appointment.name), useValue: appointmentModel },
        { provide: getModelToken(Message.name), useValue: messageModel },
      ],
    }).compile();

    service = module.get<OverviewAnalyticsService>(OverviewAnalyticsService);
  });

  describe('getOverview', () => {
    it('should return zeroed metrics when no data exists', async () => {
      // Funnel aggregation returns empty facet result
      conversationModel.aggregate.mockResolvedValue([{
        leads: [], qualified: [], bookingStarted: [], booked: [],
      }]);

      const result = await service.getOverview('week');

      expect(result.totalLeads).toBe(0);
      expect(result.totalBookings).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.avgResponseTime).toBe(0);
      expect(result.conversionFunnel).toEqual({ leads: 0, qualified: 0, bookingStarted: 0, booked: 0 });
    });

    it('should calculate conversion rate correctly', async () => {
      leadModel.countDocuments.mockResolvedValue(100);
      appointmentModel.countDocuments.mockResolvedValue(45);
      conversationModel.aggregate.mockResolvedValue([{
        leads: [{ count: 100 }],
        qualified: [{ count: 80 }],
        bookingStarted: [{ count: 60 }],
        booked: [{ count: 45 }],
      }]);

      const result = await service.getOverview('week');

      expect(result.totalLeads).toBe(100);
      expect(result.totalBookings).toBe(45);
      expect(result.conversionRate).toBe(45);
      expect(result.conversionFunnel.leads).toBe(100);
      expect(result.conversionFunnel.qualified).toBe(80);
      expect(result.conversionFunnel.bookingStarted).toBe(60);
      expect(result.conversionFunnel.booked).toBe(45);
    });

    it('should include average response time from AI messages', async () => {
      messageModel.aggregate.mockResolvedValue([{ _id: null, avg: 6.5 }]);
      conversationModel.aggregate.mockResolvedValue([{
        leads: [], qualified: [], bookingStarted: [], booked: [],
      }]);

      const result = await service.getOverview('week');

      expect(result.avgResponseTime).toBe(7); // Rounded from 6.5
    });

    it('should compute comparison percentages against previous period', async () => {
      // First two calls are for current period, next two for previous
      leadModel.countDocuments
        .mockResolvedValueOnce(100) // current leads
        .mockResolvedValueOnce(80); // previous leads
      appointmentModel.countDocuments
        .mockResolvedValueOnce(50) // current bookings
        .mockResolvedValueOnce(40); // previous bookings
      messageModel.aggregate
        .mockResolvedValueOnce([{ _id: null, avg: 5 }]) // current
        .mockResolvedValueOnce([{ _id: null, avg: 10 }]); // previous
      conversationModel.aggregate.mockResolvedValue([{
        leads: [], qualified: [], bookingStarted: [], booked: [],
      }]);

      const result = await service.getOverview('week');

      expect(result.comparison.leadsChange).toBe(25); // (100-80)/80 * 100
      expect(result.comparison.bookingsChange).toBe(25); // (50-40)/40 * 100
    });

    it('should return zero comparison when previous period has no data', async () => {
      leadModel.countDocuments
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(0);
      appointmentModel.countDocuments
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(0);
      conversationModel.aggregate.mockResolvedValue([{
        leads: [], qualified: [], bookingStarted: [], booked: [],
      }]);

      const result = await service.getOverview('week');

      expect(result.comparison.leadsChange).toBe(0);
      expect(result.comparison.bookingsChange).toBe(0);
    });

    it('should use custom date range when provided', async () => {
      conversationModel.aggregate.mockResolvedValue([{
        leads: [], qualified: [], bookingStarted: [], booked: [],
      }]);

      await service.getOverview('week', '2026-03-01', '2026-03-15');

      // Verify lead count was called (date range filtering happens internally)
      expect(leadModel.countDocuments).toHaveBeenCalled();
    });

    it('should use month period for 30-day range', async () => {
      conversationModel.aggregate.mockResolvedValue([{
        leads: [], qualified: [], bookingStarted: [], booked: [],
      }]);

      const result = await service.getOverview('month');

      expect(result).toBeDefined();
      expect(leadModel.countDocuments).toHaveBeenCalledTimes(2); // current + previous
    });

    it('should return bookings over time data', async () => {
      const timeData = [{ date: '2026-03-20', count: 5 }, { date: '2026-03-21', count: 3 }];
      appointmentModel.aggregate.mockResolvedValue(timeData);
      conversationModel.aggregate.mockResolvedValue([{
        leads: [], qualified: [], bookingStarted: [], booked: [],
      }]);

      const result = await service.getOverview('week');

      expect(result.bookingsOverTime).toEqual(timeData);
    });
  });

  describe('getClinicComparison', () => {
    it('should return formatted clinic comparison rows', async () => {
      conversationModel.aggregate.mockResolvedValue([{
        _id: 'clinic1',
        clinic: { name: 'Cardiff Physio' },
        leads: 50,
        booked: 20,
        declined: 5,
        totalMessages: 350,
      }]);

      const result = await service.getClinicComparison();

      expect(result).toHaveLength(1);
      expect(result[0].clinicName).toBe('Cardiff Physio');
      expect(result[0].conversionRate).toBe(40); // 20/50 * 100
      expect(result[0].avgMessages).toBe(7); // 350/50
      expect(result[0].declineRate).toBe(10); // 5/50 * 100
    });

    it('should return empty array when no clinics have conversations', async () => {
      conversationModel.aggregate.mockResolvedValue([]);

      const result = await service.getClinicComparison();

      expect(result).toEqual([]);
    });

    it('should handle clinic with zero leads gracefully', async () => {
      conversationModel.aggregate.mockResolvedValue([{
        _id: 'clinic1',
        clinic: { name: 'Empty Clinic' },
        leads: 0,
        booked: 0,
        declined: 0,
        totalMessages: 0,
      }]);

      const result = await service.getClinicComparison();

      expect(result[0].conversionRate).toBe(0);
      expect(result[0].avgMessages).toBe(0);
      expect(result[0].declineRate).toBe(0);
    });
  });
});
