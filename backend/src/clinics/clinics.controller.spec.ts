import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';

/** Reusable mock clinic object for assertions. */
const mockClinic = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Cardiff Physiotherapy Centre',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  serviceAreas: ['CF', 'NP', 'SA'],
  leads: 12,
  bookings: 5,
  isActive: true,
};

describe('ClinicsController', () => {
  let controller: ClinicsController;
  let service: Record<string, jest.Mock>;

  const validDto: CreateClinicDto = {
    name: 'Cardiff Physio',
    ghlLocationId: 'loc_cardiff_001',
    ghlCalendarId: 'cal_cardiff_001',
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
      findAll: jest.fn(),
      findById: jest.fn(),
      deactivate: jest.fn(),
      activate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicsController],
      providers: [{ provide: ClinicsService, useValue: service }],
    }).compile();

    controller = module.get<ClinicsController>(ClinicsController);
  });

  describe('create', () => {
    it('should call clinicsService.create and return the new clinic', async () => {
      const result = await controller.create(validDto);

      expect(service.create).toHaveBeenCalledWith(validDto);
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
      service.create.mockResolvedValue({ ...fullDto, _id: 'full123' });

      const result = await controller.create(fullDto);

      expect(service.create).toHaveBeenCalledWith(fullDto);
      expect(result.address).toBe('1 High St, Cardiff');
    });

    it('should propagate ConflictException from the service', async () => {
      service.create.mockRejectedValue(
        new ConflictException('A clinic with this GHL Location ID already exists'),
      );

      await expect(controller.create(validDto)).rejects.toThrow(ConflictException);
    });

    it('should propagate unexpected errors from the service', async () => {
      service.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.create(validDto)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findAll', () => {
    it('should return all clinics without a search query', async () => {
      service.findAll.mockResolvedValue([mockClinic]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([mockClinic]);
    });

    it('should pass the search query to the service', async () => {
      service.findAll.mockResolvedValue([mockClinic]);

      await controller.findAll('Cardiff');

      expect(service.findAll).toHaveBeenCalledWith('Cardiff');
    });
  });

  describe('findById', () => {
    it('should return a single clinic', async () => {
      service.findById.mockResolvedValue(mockClinic);

      const result = await controller.findById('507f1f77bcf86cd799439011');

      expect(service.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockClinic);
    });
  });

  describe('deactivate', () => {
    it('should deactivate the clinic', async () => {
      const deactivated = { ...mockClinic, isActive: false };
      service.deactivate.mockResolvedValue(deactivated);

      const result = await controller.deactivate('507f1f77bcf86cd799439011');

      expect(service.deactivate).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result.isActive).toBe(false);
    });
  });

  describe('activate', () => {
    it('should activate the clinic', async () => {
      service.activate.mockResolvedValue(mockClinic);

      const result = await controller.activate('507f1f77bcf86cd799439011');

      expect(service.activate).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result.isActive).toBe(true);
    });
  });
});
