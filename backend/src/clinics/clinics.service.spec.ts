/**
 * Unit tests for ClinicsService.
 * Covers listing clinics, finding by ID, clinic creation,
 * duplicate GHL Location ID detection, and database error propagation.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';

describe('ClinicsService', () => {
  let service: ClinicsService;
  let execMock: jest.Mock;
  let findByIdExecMock: jest.Mock;
  let mockModel: Record<string, jest.Mock>;

  const validDto: CreateClinicDto = {
    name: 'Test Clinic',
    ghlLocationId: 'loc_test_001',
    ghlCalendarId: 'cal_test_001',
    address: '123 Test Street, Cardiff, CF10 1AA',
    phone: '029 2034 5678',
    defaultAppointmentDuration: 30,
    serviceAreas: [{ postcodePrefix: 'CF' }],
    services: [{ name: 'Physiotherapy' }],
    businessHours: [
      { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    ],
  };

  beforeEach(async () => {
    execMock = jest.fn();
    const leanMock = jest.fn().mockReturnValue({ exec: execMock });
    const findMock = jest.fn().mockReturnValue({ lean: leanMock });

    findByIdExecMock = jest.fn();
    const findByIdLeanMock = jest.fn().mockReturnValue({ exec: findByIdExecMock });
    const findByIdMock = jest.fn().mockReturnValue({ lean: findByIdLeanMock });

    mockModel = {
      find: findMock,
      findById: findByIdMock,
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'generated_id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getModelToken(Clinic.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
  });

  /**
   * Test for listing all active clinics.
   * @see ClinicsService#findAll
   */
  describe('findAll', () => {
    it('should return all active clinics', async () => {
      const clinics = [{ _id: '1', name: 'Clinic A', isActive: true }];
      execMock.mockResolvedValue(clinics);

      const result = await service.findAll();
      expect(result).toEqual(clinics);
    });
  });

  /**
   * Test for finding a clinic by its ID.
   * @see ClinicsService#findById
   */
  describe('findById', () => {
    it('should return a clinic by ID', async () => {
      const clinic = { _id: '1', name: 'Clinic A', isActive: true };
      findByIdExecMock.mockResolvedValue(clinic);

      const result = await service.findById('1');
      expect(result).toEqual(clinic);
    });

    it('should throw NotFoundException when clinic does not exist', async () => {
      findByIdExecMock.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a clinic with required fields only', async () => {
      const minimalDto: CreateClinicDto = {
        name: 'Minimal Clinic',
        ghlLocationId: 'loc_minimal_001',
        ghlCalendarId: 'cal_minimal_001',
      };
      mockModel.create.mockResolvedValue({ ...minimalDto, _id: 'new_id' });

      const result = await service.create(minimalDto);

      expect(mockModel.findOne).toHaveBeenCalledWith({ ghlLocationId: 'loc_minimal_001' });
      expect(mockModel.create).toHaveBeenCalledWith(minimalDto);
      expect(result).toHaveProperty('_id');
    });

    it('should create a clinic with all fields', async () => {
      const result = await service.create(validDto);

      expect(mockModel.create).toHaveBeenCalledWith(validDto);
      expect(result.name).toBe('Test Clinic');
    });

    it('should throw ConflictException for duplicate ghlLocationId', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'existing_id' }),
      });

      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
      await expect(service.create(validDto)).rejects.toThrow(
        'A clinic with this GHL Location ID already exists',
      );
      expect(mockModel.create).not.toHaveBeenCalled();
    });

    it('should propagate database errors from create', async () => {
      mockModel.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.create(validDto)).rejects.toThrow('DB connection lost');
    });

    it('should propagate database errors from findOne', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Query timeout')),
      });

      await expect(service.create(validDto)).rejects.toThrow('Query timeout');
    });
  });
});
