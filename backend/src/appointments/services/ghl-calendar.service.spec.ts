import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { GHLCalendarService } from './ghl-calendar.service';

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

  describe('fetchAvailableSlots', () => {
    const calendarId = 'cal_123';
    const startDate = new Date('2024-03-25');
    const endDate = new Date('2024-03-26');
    const apiKey = 'api_key';

    it('should fetch slots successfully', async () => {
      const mockSlots = [
        {
          id: '1',
          startTime: '2024-03-25T14:00:00Z',
          endTime: '2024-03-25T14:20:00Z',
          available: true,
        },
      ];

      const mockResponse: AxiosResponse = {
        data: { slots: mockSlots },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.fetchAvailableSlots(
        calendarId,
        startDate,
        endDate,
        apiKey,
      );

      expect(result).toEqual(mockSlots);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(calendarId),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('should return empty array if no slots in response', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      const result = await service.fetchAvailableSlots(
        calendarId,
        startDate,
        endDate,
        apiKey,
      );

      expect(result).toEqual([]);
    });

  });

  describe('createAppointment', () => {
    const calendarId = 'cal_123';
    const contactId = 'contact_123';
    const slotId = 'slot_123';
    const apiKey = 'api_key';

    it('should create appointment successfully', async () => {
      const mockResponse: AxiosResponse = {
        data: { id: 'appt_123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.createAppointment(
        calendarId,
        contactId,
        slotId,
        apiKey,
      );

      expect(result).toEqual({ appointmentId: 'appt_123' });
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should throw error on appointment creation failure', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Creation failed')),
      );

      await expect(
        service.createAppointment(calendarId, contactId, slotId, apiKey),
      ).rejects.toThrow('Creation failed');
    });
  });
});