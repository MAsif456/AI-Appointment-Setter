import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { SlotsService } from './services/slots.service';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let slotsService: SlotsService;

  const mockSlotsService = {
    fetchAvailableSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [{ provide: SlotsService, useValue: mockSlotsService }],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
    slotsService = module.get<SlotsService>(SlotsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('should return available slots', async () => {
      const mockSlots = [
        {
          date: '2024-03-25',
          startTime: '14:00',
          endTime: '14:30',
          dateTime: new Date('2024-03-25T14:00:00Z'),
        },
      ];

      mockSlotsService.fetchAvailableSlots.mockResolvedValue(mockSlots);

      const result = await controller.getAvailableSlots({
        clinicId: 'clinic_123',
        startDate: '2024-03-25',
        endDate: '2024-03-26',
      });

      expect(result).toEqual(mockSlots);
      expect(slotsService.fetchAvailableSlots).toHaveBeenCalledWith(
        'clinic_123',
        new Date('2024-03-25'),
        new Date('2024-03-26'),
      );
    });

    it('should return empty array when no slots available', async () => {
      mockSlotsService.fetchAvailableSlots.mockResolvedValue([]);

      const result = await controller.getAvailableSlots({
        clinicId: 'clinic_123',
        startDate: '2024-03-25',
        endDate: '2024-03-26',
      });

      expect(result).toEqual([]);
    });
  });
});