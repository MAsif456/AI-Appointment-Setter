import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';

/** Helper to build a mock clinic document with a save() method. */
const mockClinic = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Cardiff Physiotherapy Centre',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  serviceAreas: ['CF', 'NP', 'SA'],
  leads: 12,
  bookings: 5,
  isActive: true,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('ClinicsService', () => {
  let service: ClinicsService;
  let model: Record<string, jest.Mock>;

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
    model = {
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'generated_id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getModelToken(Clinic.name), useValue: model },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
  });

  describe('create', () => {
    it('should create a clinic with required fields only', async () => {
      const minimalDto: CreateClinicDto = {
        name: 'Minimal Clinic',
        ghlLocationId: 'loc_minimal_001',
        ghlCalendarId: 'cal_minimal_001',
      };
      model.create.mockResolvedValue({ ...minimalDto, _id: 'new_id' });

      const result = await service.create(minimalDto);

      expect(model.findOne).toHaveBeenCalledWith({ ghlLocationId: 'loc_minimal_001' });
      expect(model.create).toHaveBeenCalledWith(minimalDto);
      expect(result).toHaveProperty('_id');
    });

    it('should create a clinic with all fields', async () => {
      const result = await service.create(validDto);

      expect(model.create).toHaveBeenCalledWith(validDto);
      expect(result.name).toBe('Test Clinic');
    });

    it('should throw ConflictException for duplicate ghlLocationId', async () => {
      model.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'existing_id' }),
      });

      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
      await expect(service.create(validDto)).rejects.toThrow(
        'A clinic with this GHL Location ID already exists',
      );
      expect(model.create).not.toHaveBeenCalled();
    });

    it('should propagate database errors from create', async () => {
      model.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.create(validDto)).rejects.toThrow('DB connection lost');
    });

    it('should propagate database errors from findOne', async () => {
      model.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Query timeout')),
      });

      await expect(service.create(validDto)).rejects.toThrow('Query timeout');
    });
  });

  describe('findAll', () => {
    it('should return all clinics when no search term is provided', async () => {
      const clinics = [mockClinic()];
      model.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(clinics) }) });

      const result = await service.findAll();

      expect(model.find).toHaveBeenCalledWith({});
      expect(result).toEqual(clinics);
    });

    it('should filter clinics by name when a search term is provided', async () => {
      const clinics = [mockClinic()];
      model.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(clinics) }) });

      const result = await service.findAll('Cardiff');

      expect(model.find).toHaveBeenCalledWith({
        name: { $regex: 'Cardiff', $options: 'i' },
      });
      expect(result).toEqual(clinics);
    });
  });

  describe('findById', () => {
    it('should return the clinic when it exists', async () => {
      const clinic = mockClinic();
      model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(clinic) });

      const result = await service.findById('507f1f77bcf86cd799439011');

      expect(result).toEqual(clinic);
    });

    it('should throw NotFoundException when clinic does not exist', async () => {
      model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false and save', async () => {
      const clinic = mockClinic({ isActive: true });
      clinic.save.mockResolvedValue({ ...clinic, isActive: false });
      model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(clinic) });

      const result = await service.deactivate('507f1f77bcf86cd799439011');

      expect(clinic.isActive).toBe(false);
      expect(clinic.save).toHaveBeenCalled();
      expect(result).toEqual({ ...clinic, isActive: false });
    });
  });

  describe('activate', () => {
    it('should set isActive to true and save', async () => {
      const clinic = mockClinic({ isActive: false });
      clinic.save.mockResolvedValue({ ...clinic, isActive: true });
      model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(clinic) });

      const result = await service.activate('507f1f77bcf86cd799439011');

      expect(clinic.isActive).toBe(true);
      expect(clinic.save).toHaveBeenCalled();
      expect(result).toEqual({ ...clinic, isActive: true });
    });
  });
});
