import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { GHLCalendarService } from './ghl-calendar.service';
import { AxiosResponse } from 'axios';

describe('GHLCalendarService', () => {
  let service: GHLCalendarService;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GHLCalendarService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<GHLCalendarService>(GHLCalendarService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAvailableSlots - Real GHL API', () => {
    it('should parse GHL response correctly', async () => {
      // Mock GHL response structure
      const mockGHLResponse = {
        '2026-03-25': {
          slots: [
            '2026-03-25T08:00:00Z',
            '2026-03-25T08:10:00Z',
            '2026-03-25T08:20:00Z',
          ],
        },
        '2026-03-26': {
          slots: [
            '2026-03-26T09:00:00Z',
          ],
        },
        traceId: 'test-trace-id',
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const startDate = new Date('2026-03-25');
      const endDate = new Date('2026-03-27');

      const result = await service.fetchAvailableSlots(
        'cal_123',
        startDate,
        endDate,
        'api_key',
      );

      // Should have 4 slots total (3 from 03-25, 1 from 03-26)
      expect(result.length).toBe(4);

      // Check first slot
      expect(result[0].id).toContain('ghl_slot_');
      expect(result[0].startTime).toBe('2026-03-25T08:00:00.000Z');
      expect(result[0].available).toBe(true);

      // Check slot duration (10 minutes)
      const start = new Date(result[0].startTime);
      const end = new Date(result[0].endTime);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);
      expect(duration).toBe(10);
    });

    it('should ignore traceId in response', async () => {
      const mockGHLResponse = {
        '2026-03-25': {
          slots: ['2026-03-25T08:00:00Z'],
        },
        traceId: 'should-be-ignored',
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.fetchAvailableSlots(
        'cal_123',
        new Date('2026-03-25'),
        new Date('2026-03-26'),
        'api_key',
      );

      expect(result.length).toBe(1);
    });

    it('should handle empty slots array', async () => {
      const mockGHLResponse = {
        '2026-03-25': {
          slots: [],
        },
        traceId: 'test',
      };

      const axiosResponse: AxiosResponse = {
        data: mockGHLResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.fetchAvailableSlots(
        'cal_123',
        new Date('2026-03-25'),
        new Date('2026-03-26'),
        'api_key',
      );

      expect(result).toEqual([]);
    });
  });

  describe('fetchAvailableSlots - Fallback to Mock Data', () => {
    it('should fall back to mock data on API error', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const startDate = new Date('2024-03-25'); // Monday
      const endDate = new Date('2024-03-26'); // Tuesday

      const result = await service.fetchAvailableSlots(
        'cal_123',
        startDate,
        endDate,
        'api_key',
      );

      // Should generate mock slots
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toContain('mock_slot_');
    });

    it('should generate mock slots for weekdays only', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      const startDate = new Date('2024-03-30'); // Saturday
      const endDate = new Date('2024-03-31'); // Sunday

      const result = await service.fetchAvailableSlots(
        'cal_123',
        startDate,
        endDate,
        'api_key',
      );

      expect(result).toEqual([]);
    });

    it('should generate 30-minute mock slots from 8am to 6pm', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      const startDate = new Date('2024-03-25'); // Monday
      const endDate = new Date('2024-03-26'); // Tuesday

      const result = await service.fetchAvailableSlots(
        'cal_123',
        startDate,
        endDate,
        'api_key',
      );

      // 10 hours * 1 slot per hour = 10 slots
      expect(result.length).toBe(10);

      // Check first slot is 8am
      const firstSlot = new Date(result[0].startTime);
      expect(firstSlot.getHours()).toBe(8);

      // Check duration
      const start = new Date(result[0].startTime);
      const end = new Date(result[0].endTime);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);
      expect(duration).toBe(30);
    });
  });

  describe('createAppointment', () => {
    it('should return mock appointment ID on error', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      const result = await service.createAppointment(
        'cal_123',
        'contact_123',
        'slot_123',
        'api_key',
      );

      expect(result).toHaveProperty('appointmentId');
      expect(result.appointmentId).toContain('mock_appt_');
    });
  });
});