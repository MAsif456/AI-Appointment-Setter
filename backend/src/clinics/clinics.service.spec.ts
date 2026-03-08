/**
 * Unit tests for ClinicsService.
 * Covers listing clinics, finding by ID, clinic creation,
 * duplicate GHL Location ID detection, and database error propagation.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

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
    const findMock = jest.fn().mockReturnValue({ exec: execMock });

    findByIdExecMock = jest.fn();
    const findByIdLeanMock = jest.fn().mockReturnValue({ exec: findByIdExecMock });
    const findByIdMock = jest.fn().mockReturnValue({ lean: findByIdLeanMock, exec: findByIdExecMock });

    mockModel = {
      find: findMock,
      findById: findByIdMock,
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'generated_id' }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
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
   * Test for listing all clinics.
   * @see ClinicsService#findAll
   */
  describe('findAll', () => {
    it('should return all clinics', async () => {
      const clinics = [{ _id: '1', name: 'Clinic A', isActive: true }];
      execMock.mockResolvedValue(clinics);

      const result = await service.findAll();
      expect(result).toEqual(clinics);
    });

    it('should return an empty array when no clinics exist', async () => {
      execMock.mockResolvedValue([]);

      const result = await service.findAll();
      expect(result).toEqual([]);
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

  describe('findOne', () => {
    it('should return a clinic by valid ID', async () => {
      const clinic = { _id: '507f1f77bcf86cd799439011', name: 'Test Clinic' };
      mockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(clinic) });

      const result = await service.findOne('507f1f77bcf86cd799439011');

      expect(mockModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(clinic);
    });

    it('should throw BadRequestException for an invalid ID format', async () => {
      await expect(service.findOne('not-an-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for an undefined ID string', async () => {
      await expect(service.findOne('undefined')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when clinic is not found', async () => {
      mockModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBasicSettings', () => {
    it('should update a clinic and return the saved document', async () => {
      const update: UpdateClinicSettingsDto = { name: 'New Name' };
      const updated = { _id: '507f1f77bcf86cd799439011', name: 'New Name' };
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateBasicSettings('507f1f77bcf86cd799439011', update);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ name: 'New Name' }),
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('should only include defined fields in the update payload', async () => {
      const update: UpdateClinicSettingsDto = { name: 'Only Name' };
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'Only Name' }),
      });

      await service.updateBasicSettings('507f1f77bcf86cd799439011', update);

      const payload = mockModel.findByIdAndUpdate.mock.calls[0][1];
      expect(payload).not.toHaveProperty('address');
      expect(payload).not.toHaveProperty('phone');
    });

    it('should throw BadRequestException for invalid ID in updateBasicSettings', async () => {
      await expect(service.updateBasicSettings('bad-id', { name: 'X' })).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when the clinic to update does not exist', async () => {
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        service.updateBasicSettings('507f1f77bcf86cd799439011', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update serviceAreas when provided', async () => {
      const update: UpdateClinicSettingsDto = { serviceAreas: [{ postcodePrefix: 'CF' }] };
      const updated = { _id: '507f1f77bcf86cd799439011', serviceAreas: [{ postcodePrefix: 'CF' }] };
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateBasicSettings('507f1f77bcf86cd799439011', update);

      const payload = mockModel.findByIdAndUpdate.mock.calls[0][1];
      expect(payload.serviceAreas).toEqual([{ postcodePrefix: 'CF' }]);
      expect(result).toEqual(updated);
    });

    it('should update businessHours when provided', async () => {
      const update: UpdateClinicSettingsDto = {
        businessHours: [{ day: 'monday', isOpen: true, openTime: '08:00', closeTime: '16:00' }],
      };
      const updated = { _id: '507f1f77bcf86cd799439011', businessHours: update.businessHours };
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      await service.updateBasicSettings('507f1f77bcf86cd799439011', update);

      const payload = mockModel.findByIdAndUpdate.mock.calls[0][1];
      expect(payload.businessHours[0].openTime).toBe('08:00');
    });
  });
});
