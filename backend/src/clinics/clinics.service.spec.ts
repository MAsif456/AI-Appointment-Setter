import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';

/**
 * Unit tests for ClinicsService.
 *
 * Covers clinic creation, duplicate GHL Location ID detection,
 * and database error propagation. The Mongoose model is mocked.
 */
describe('ClinicsService', () => {
  let service: ClinicsService;
  let mockClinicModel: Record<string, jest.Mock>;

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
    mockClinicModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'generated_id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getModelToken(Clinic.name), useValue: mockClinicModel },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
  });

  it('should create a clinic with required fields only', async () => {
    const minimalDto: CreateClinicDto = {
      name: 'Minimal Clinic',
      ghlLocationId: 'loc_minimal_001',
      ghlCalendarId: 'cal_minimal_001',
    };
    mockClinicModel.create.mockResolvedValue({ ...minimalDto, _id: 'new_id' });

    const result = await service.create(minimalDto);

    expect(mockClinicModel.findOne).toHaveBeenCalledWith({ ghlLocationId: 'loc_minimal_001' });
    expect(mockClinicModel.create).toHaveBeenCalledWith(minimalDto);
    expect(result).toHaveProperty('_id');
  });

  it('should create a clinic with all fields', async () => {
    const result = await service.create(validDto);

    expect(mockClinicModel.create).toHaveBeenCalledWith(validDto);
    expect(result.name).toBe('Test Clinic');
  });

  it('should throw ConflictException for duplicate ghlLocationId', async () => {
    mockClinicModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'existing_id' }),
    });

    await expect(service.create(validDto)).rejects.toThrow(ConflictException);
    await expect(service.create(validDto)).rejects.toThrow(
      'A clinic with this GHL Location ID already exists',
    );
    expect(mockClinicModel.create).not.toHaveBeenCalled();
  });

  it('should propagate database errors from create', async () => {
    mockClinicModel.create.mockRejectedValue(new Error('DB connection lost'));

    await expect(service.create(validDto)).rejects.toThrow('DB connection lost');
  });

  it('should propagate database errors from findOne', async () => {
    mockClinicModel.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('Query timeout')),
    });

    await expect(service.create(validDto)).rejects.toThrow('Query timeout');
  });
});
