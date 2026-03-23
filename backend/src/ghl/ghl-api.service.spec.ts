import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders } from 'axios';
import { GhlApiService } from './ghl-api.service';
import { SendMessageDto } from './dto/send-message.dto';

describe('GhlApiService', () => {
  let service: GhlApiService;
  let httpService: { post: jest.Mock; get: jest.Mock };
  let configService: { get: jest.Mock };

/**
 * Returns a mock AxiosResponse object with the given data.
 * The mock response will have a status of 200 and a statusText of 'OK',
 * and will contain the given data in its data property.
 * The headers property will be an empty object, and the config property
 * will contain an empty AxiosHeaders object.
 * @param {any} data - The data to include in the mock response.
 * @returns {AxiosResponse} - The mock AxiosResponse object.
 */
  const mockAxiosResponse = (data: any): AxiosResponse => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

  beforeEach(async () => {
    httpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('test-private-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GhlApiService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<GhlApiService>(GhlApiService);
  });

  describe('sendMessageWithRetry', () => {
    const dto: SendMessageDto = {
      type: 'SMS',
      contactId: 'contact_123',
      message: 'Hello, how can I help you?',
    };

    it('should send a message successfully on first attempt', async () => {
      const responseData = { messageId: 'msg_001' };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.sendMessageWithRetry(dto);

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(httpService.post).toHaveBeenCalledWith(
        '/conversations/messages',
        { type: 'SMS', contactId: 'contact_123', message: dto.message, status: 'pending' },
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-private-token' }) }),
      );
    });

    it('should retry up to 3 times on failure then throw', async () => {
      const error = new Error('Network error');
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.sendMessageWithRetry(dto)).rejects.toThrow('Network error');
      expect(httpService.post).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should succeed on second attempt after first failure', async () => {
      const error = new Error('Temporary error');
      const responseData = { messageId: 'msg_002' };

      httpService.post
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(of(mockAxiosResponse(responseData)));

      const result = await service.sendMessageWithRetry(dto);

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe('getConversation', () => {
    it('should fetch a conversation by ID', async () => {
      const responseData = { id: 'conv_123', contactId: 'contact_123' };
      httpService.get.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.getConversation('conv_123');

      expect(result).toEqual(responseData);
      expect(httpService.get).toHaveBeenCalledWith(
        '/conversations/conv_123',
        expect.objectContaining({ headers: expect.objectContaining({ Version: '2021-07-28' }) }),
      );
    });
  });

  describe('createConversation', () => {
    it('should create a conversation via GHL API', async () => {
      const responseData = { id: 'conv_new', contactId: 'contact_123' };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.createConversation('contact_123', 'loc_001');

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledWith(
        '/conversations/',
        { contactId: 'contact_123', locationId: 'loc_001' },
        expect.any(Object),
      );
    });
  });

  describe('createAppointment', () => {
    it('should create an appointment via GHL Calendar API', async () => {
      const responseData = { id: 'apt_123' };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.createAppointment(
        'cal_001', 'loc_001', 'contact_123',
        '2026-03-17T14:00:00Z', '2026-03-17T14:30:00Z',
      );

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledWith(
        '/calendars/events/appointments',
        {
          calendarId: 'cal_001',
          locationId: 'loc_001',
          contactId: 'contact_123',
          startTime: '2026-03-17T14:00:00Z',
          endTime: '2026-03-17T14:30:00Z',
          appointmentStatus: 'confirmed',
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-private-token',
          }),
        }),
      );
    });

    it('should propagate errors from GHL Calendar API', async () => {
      const error = new Error('Calendar API error');
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(
        service.createAppointment(
          'cal_001', 'loc_001', 'contact_123',
          '2026-03-17T14:00:00Z', '2026-03-17T14:30:00Z',
        ),
      ).rejects.toThrow('Calendar API error');
    });
  });
});
