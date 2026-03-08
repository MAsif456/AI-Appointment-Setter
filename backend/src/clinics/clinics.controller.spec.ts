import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

/**
 * Unit tests for ClinicsController.
 * Mocks the service layer and tests HTTP-level behaviour.
 *
 * The ClinicsController is responsible for handling requests related to clinics.
 * It delegates the actual work to the ClinicsService.
 */
describe('ClinicsController', () => {
  let controller: ClinicsController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    updateBasicSettings: jest.Mock;
  };

  const validDto: CreateClinicDto = {
    name: 'Cardiff Physio',
    ghlLocationId: 'loc_cardiff_001',
    ghlCalendarId: 'cal_cardiff_001',
  };

  beforeEach(async () => {
    /**
     * Reset the mocked service layer before running each test.
     * This ensures that the test results are not affected by previous tests.
     */
    service = {
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
      updateBasicSettings: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicsController],
      providers: [{ provide: ClinicsService, useValue: service }],
    }).compile();

    controller = module.get<ClinicsController>(ClinicsController);
  });

  /**
   * GET /api/clinics
   * Returns a list of all clinics.
   */
  describe('GET /api/clinics', () => {
    it('should return all clinics', async () => {
      const clinics = [{ _id: '1', name: 'Clinic A', isActive: true }];
      service.findAll.mockResolvedValue(clinics);

      const result = await controller.findAll();
      expect(result).toEqual(clinics);
    });

    it('should return an empty array when no clinics exist', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    it('should propagate errors from findAll', async () => {
      service.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.findAll()).rejects.toThrow('DB error');
    });
  });

  /**
   * GET /api/clinics/:id
   * Returns a single clinic by its ID.
   */
  describe('GET /api/clinics/:id', () => {
    it('should return a clinic by ID', async () => {
      const clinic = { _id: '507f1f77bcf86cd799439011', name: 'Cardiff Physio' };
      service.findOne.mockResolvedValue(clinic);

      const result = await controller.findOne('507f1f77bcf86cd799439011');

      expect(service.findOne).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(clinic);
    });

    it('should propagate BadRequestException from findOne', async () => {
      service.findOne.mockRejectedValue(new BadRequestException('Invalid clinic ID'));

      await expect(controller.findOne('bad-id')).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException from findOne', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Clinic not found'));

      await expect(controller.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  /**
   * POST /api/clinics
   * Creates a new clinic.
   */
  describe('POST /api/clinics', () => {
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

  /**
   * PATCH /api/clinics/:id/settings
   * Partially updates a clinic's basic settings.
   */
  describe('PATCH /api/clinics/:id/settings', () => {
    it('should call clinicsService.updateBasicSettings and return the updated clinic', async () => {
      const body: UpdateClinicSettingsDto = { name: 'Updated Name' };
      const updated = { ...validDto, _id: 'abc123', name: 'Updated Name' };
      service.updateBasicSettings.mockResolvedValue(updated);

      const result = await controller.updateSettings('abc123', body);

      expect(service.updateBasicSettings).toHaveBeenCalledWith('abc123', body);
      expect(result).toEqual(updated);
    });

    it('should propagate BadRequestException from updateSettings', async () => {
      service.updateBasicSettings.mockRejectedValue(new BadRequestException('Invalid clinic ID'));

      await expect(controller.updateSettings('bad-id', {})).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException from updateSettings', async () => {
      service.updateBasicSettings.mockRejectedValue(new NotFoundException('Clinic not found'));

      await expect(controller.updateSettings('507f1f77bcf86cd799439011', {})).rejects.toThrow(NotFoundException);
    });

    it('should pass all update fields through to the service', async () => {
      const body: UpdateClinicSettingsDto = {
        name: 'New Name',
        address: '2 New St',
        phone: '020 1234 5678',
        serviceAreas: [{ postcodePrefix: 'SW' }],
        businessHours: [{ day: 'friday', isOpen: false }],
      };
      service.updateBasicSettings.mockResolvedValue({ _id: 'abc123', ...body });

      await controller.updateSettings('abc123', body);

      expect(service.updateBasicSettings).toHaveBeenCalledWith('abc123', body);
    });
  });
});
