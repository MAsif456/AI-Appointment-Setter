import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';

/**
 * Unit tests for ClinicsController.
 *
 * Verifies that the controller delegates to the service and
 * propagates both successful results and exceptions correctly.
 */
describe('ClinicsController', () => {
  let controller: ClinicsController;
  let mockService: { create: jest.Mock };

  const validDto: CreateClinicDto = {
    name: 'Cardiff Physio',
    ghlLocationId: 'loc_cardiff_001',
    ghlCalendarId: 'cal_cardiff_001',
  };

  beforeEach(async () => {
    mockService = {
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicsController],
      providers: [{ provide: ClinicsService, useValue: mockService }],
    }).compile();

    controller = module.get<ClinicsController>(ClinicsController);
  });

  it('should call clinicsService.create and return the new clinic', async () => {
    const result = await controller.create(validDto);

    expect(mockService.create).toHaveBeenCalledWith(validDto);
    expect(result).toEqual({ ...validDto, _id: 'abc123' });
  });

  it('should pass optional fields through to the service', async () => {
    const fullDto: CreateClinicDto = {
      ...validDto,
      address: '1 High St, Cardiff',
      phone: '029 2034 5678',
      defaultAppointmentDuration: 45,
      serviceAreas: [{ postcodePrefix: 'CF' }],
      services: [{ name: 'Back pain', durationMinutes: 30 }],
      businessHours: [{ day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' }],
    };
    mockService.create.mockResolvedValue({ ...fullDto, _id: 'full123' });

    const result = await controller.create(fullDto);

    expect(mockService.create).toHaveBeenCalledWith(fullDto);
    expect(result.address).toBe('1 High St, Cardiff');
  });

  it('should propagate ConflictException from the service', async () => {
    mockService.create.mockRejectedValue(
      new ConflictException('A clinic with this GHL Location ID already exists'),
    );

    await expect(controller.create(validDto)).rejects.toThrow(ConflictException);
  });

  it('should propagate unexpected errors from the service', async () => {
    mockService.create.mockRejectedValue(new Error('Database connection failed'));

    await expect(controller.create(validDto)).rejects.toThrow('Database connection failed');
  });
});
