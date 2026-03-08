import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';

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
    /** Mocked ClinicsService method to return all active clinics. */
    findAll: jest.Mock;
    /** Mocked ClinicsService method to return a single clinic by ID. */
    findById: jest.Mock;
    /** Mocked ClinicsService method to create a new clinic. */
    create: jest.Mock;
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
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicsController],
      providers: [{ provide: ClinicsService, useValue: service }],
    }).compile();

    controller = module.get<ClinicsController>(ClinicsController);
  });

  /**
   * GET /api/clinics
   * Returns a list of all active clinics.
   * @returns Array of clinic summary documents
   */
  describe('GET /api/clinics', () => {
    it('should return all clinics', async () => {
      // Mock the service layer to return a list of clinics
      const clinics = [{ _id: '1', name: 'Clinic A', isActive: true }];
      service.findAll.mockResolvedValue(clinics);

      // Call the controller and verify the result
      const result = await controller.findAll();
      expect(result).toEqual(clinics);
    });
  });

  /**
   * GET /api/clinics/:id
   * Returns a single clinic by its ID.
   * @param id - The MongoDB ObjectId of the clinic
   * @returns The clinic document
   * @throws NotFoundException if the clinic does not exist
   */
  describe('GET /api/clinics/:id', () => {
    it('should return a clinic by ID', async () => {
      const clinic = { _id: '1', name: 'Clinic A', isActive: true };
      service.findById.mockResolvedValue(clinic);

      // Call the controller and verify the result
      const result = await controller.findById('1');
      expect(result).toEqual(clinic);
    });

    it('should propagate NotFoundException', async () => {
      // Mock the service layer to throw a NotFoundException
      service.findById.mockRejectedValue(new NotFoundException());

      // Call the controller and verify the exception is propagated
      await expect(controller.findById('bad')).rejects.toThrow(NotFoundException);
    });
  });

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
