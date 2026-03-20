import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SlotsService } from './slots.service';
import { GHLCalendarService } from './ghl-calendar.service';

describe('SlotsService - US-12', () => {
  let service: SlotsService;

  const mockClinicModel = {
    findById: jest.fn(),
  };

  const mockGHLCalendarService = {
    fetchAvailableSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotsService,
        { provide: getModelToken('Clinic'), useValue: mockClinicModel },
        { provide: GHLCalendarService, useValue: mockGHLCalendarService },
      ],
    }).compile();

    service = module.get<SlotsService>(SlotsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockClinic = {
    _id: new Types.ObjectId().toString(),
    ghlCalendarId: 'cal_123',
    ghlApiKey: 'api_key',
    defaultAppointmentDuration: 30,
    businessHours: [
      {
        day: 'monday',
        isOpen: true,
        openTime: '09:00',
        closeTime: '17:00',
      },
      {
        day: 'tuesday',
        isOpen: true,
        openTime: '09:00',
        closeTime: '17:00',
      },
      {
        day: 'wednesday',
        isOpen: true,
        openTime: '09:00',
        closeTime: '17:00',
      },
      {
        day: 'thursday',
        isOpen: true,
        openTime: '09:00',
        closeTime: '17:00',
      },
      {
        day: 'friday',
        isOpen: true,
        openTime: '09:00',
        closeTime: '17:00',
      },
      {
        day: 'saturday',
        isOpen: false,
      },
      {
        day: 'sunday',
        isOpen: false,
      },
    ],
  };

  describe('fetchAvailableSlots', () => {
    it('should return empty array if clinic not found', async () => {
      mockClinicModel.findById.mockResolvedValue(null);

      const result = await service.fetchAvailableSlots(
        'invalid',
        new Date(),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it('should return empty array if clinic has no API key', async () => {
      const clinicWithoutKey = { ...mockClinic, ghlApiKey: undefined };
      mockClinicModel.findById.mockResolvedValue(clinicWithoutKey);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date(),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it('should return empty array if no GHL slots available', async () => {
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue([]);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date(),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it('should return empty array if GHL returns null', async () => {
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(null);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date(),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it('should handle GHL API errors gracefully', async () => {
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockRejectedValue(
        new Error('API Error'),
      );

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date(),
        new Date(),
      );

      expect(result).toEqual([]);
    });

    it('should filter slots before business hours', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T08:00:00Z', // Before 09:00
          endTime: '2024-03-25T08:30:00Z',
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result).toEqual([]);
    });

    it('should filter slots after business hours', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T18:00:00Z', // After 17:00
          endTime: '2024-03-25T18:30:00Z',
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result).toEqual([]);
    });

    it('should filter slots on closed days (Saturday)', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-30T10:00:00Z', // Saturday
          endTime: '2024-03-30T10:30:00Z',
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-30'),
        new Date('2024-03-31'),
      );

      expect(result).toEqual([]);
    });

    it('should filter slots on closed days (Sunday)', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-31T10:00:00Z', // Sunday
          endTime: '2024-03-31T10:30:00Z',
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-31'),
        new Date('2024-04-01'),
      );

      expect(result).toEqual([]);
    });

    it('should filter slots when business hours missing openTime', async () => {
      const clinicWithMissingHours = {
        ...mockClinic,
        businessHours: [
          {
            day: 'monday',
            isOpen: true,
            openTime: undefined, // Missing
            closeTime: '17:00',
          },
        ],
      };

      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T10:00:00Z', // Monday
          endTime: '2024-03-25T10:30:00Z',
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(clinicWithMissingHours);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result).toEqual([]);
    });

    it('should filter slots when business hours missing closeTime', async () => {
      const clinicWithMissingHours = {
        ...mockClinic,
        businessHours: [
          {
            day: 'monday',
            isOpen: true,
            openTime: '09:00',
            closeTime: undefined, // Missing
          },
        ],
      };

      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T10:00:00Z', // Monday
          endTime: '2024-03-25T10:30:00Z',
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(clinicWithMissingHours);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result).toEqual([]);
    });

    it('should filter slots shorter than appointment duration', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T14:00:00Z',
          endTime: '2024-03-25T14:15:00Z', // 15 min (too short)
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result).toEqual([]);
    });

    it('should accept slots equal to appointment duration', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T14:00:00Z',
          endTime: '2024-03-25T14:30:00Z', // Exactly 30 min
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result.length).toBe(1);
    });

    it('should accept slots longer than appointment duration', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T14:00:00Z',
          endTime: '2024-03-25T15:00:00Z', // 60 min
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result.length).toBe(1);
    });

    it('should format slots correctly', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T14:00:00Z',
          endTime: '2024-03-25T14:30:00Z',
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('startTime');
      expect(result[0]).toHaveProperty('endTime');
      expect(result[0]).toHaveProperty('dateTime');
      expect(result[0].date).toBe('2024-03-25');
      expect(typeof result[0].startTime).toBe('string');
      expect(typeof result[0].endTime).toBe('string');
      expect(result[0].dateTime).toBeInstanceOf(Date);
    });

    it('should return valid slots within business hours', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T10:00:00Z', // 10:00 - within hours
          endTime: '2024-03-25T10:30:00Z',
          available: true,
        },
        {
          id: '2',
          startTime: '2024-03-25T14:00:00Z', // 14:00 - within hours
          endTime: '2024-03-25T14:30:00Z',
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      expect(result.length).toBe(2);
    });

    it('should handle mixed valid and invalid slots', async () => {
      const mockGHLSlots = [
        {
          id: '1',
          startTime: '2024-03-25T08:00:00Z', // Before hours - invalid
          endTime: '2024-03-25T08:30:00Z',
          available: true,
        },
        {
          id: '2',
          startTime: '2024-03-25T10:00:00Z', // Valid
          endTime: '2024-03-25T10:30:00Z',
          available: true,
        },
        {
          id: '3',
          startTime: '2024-03-25T18:00:00Z', // After hours - invalid
          endTime: '2024-03-25T18:30:00Z',
          available: true,
        },
        {
          id: '4',
          startTime: '2024-03-25T14:00:00Z', // Valid
          endTime: '2024-03-25T14:15:00Z', // But too short - invalid
          available: true,
        },
      ];

      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockGHLCalendarService.fetchAvailableSlots.mockResolvedValue(mockGHLSlots);

      const result = await service.fetchAvailableSlots(
        mockClinic._id,
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );

      // Only slot 2 should pass all filters
      expect(result.length).toBe(1);
    });
  });
});