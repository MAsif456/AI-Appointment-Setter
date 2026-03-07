import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

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

  // findAll

  it('should return all clinics', async () => {
    const clinics = [{ _id: '1', name: 'Clinic A' }, { _id: '2', name: 'Clinic B' }];
    mockClinicModel.find = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(clinics) });

    const result = await service.findAll();

    expect(mockClinicModel.find).toHaveBeenCalled();
    expect(result).toEqual(clinics);
  });

  it('should return an empty array when no clinics exist', async () => {
    mockClinicModel.find = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

    const result = await service.findAll();

    expect(result).toEqual([]);
  });

  // findOne

  it('should return a clinic by valid ID', async () => {
    const clinic = { _id: '507f1f77bcf86cd799439011', name: 'Test Clinic' };
    mockClinicModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(clinic) });

    const result = await service.findOne('507f1f77bcf86cd799439011');

    expect(mockClinicModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(result).toEqual(clinic);
  });

  it('should throw BadRequestException for an invalid ID format', async () => {
    await expect(service.findOne('not-an-id')).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for an undefined ID string', async () => {
    await expect(service.findOne('undefined')).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when clinic is not found', async () => {
    mockClinicModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
  });

  // updateBasicSettings

  it('should update a clinic and return the saved document', async () => {
    const update: UpdateClinicSettingsDto = { name: 'New Name' };
    const updated = { _id: '507f1f77bcf86cd799439011', name: 'New Name' };
    mockClinicModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

    const result = await service.updateBasicSettings('507f1f77bcf86cd799439011', update);

    expect(mockClinicModel.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ name: 'New Name' }),
      { new: true },
    );
    expect(result).toEqual(updated);
  });

  it('should only include defined fields in the update payload', async () => {
    const update: UpdateClinicSettingsDto = { name: 'Only Name' };
    mockClinicModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'Only Name' }),
    });

    await service.updateBasicSettings('507f1f77bcf86cd799439011', update);

    const payload = mockClinicModel.findByIdAndUpdate.mock.calls[0][1];
    expect(payload).not.toHaveProperty('address');
    expect(payload).not.toHaveProperty('phone');
  });

  it('should throw BadRequestException for invalid ID in updateBasicSettings', async () => {
    await expect(service.updateBasicSettings('bad-id', { name: 'X' })).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when the clinic to update does not exist', async () => {
    mockClinicModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    await expect(
      service.updateBasicSettings('507f1f77bcf86cd799439011', { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update serviceAreas when provided', async () => {
    const update: UpdateClinicSettingsDto = { serviceAreas: [{ postcodePrefix: 'CF' }] };
    const updated = { _id: '507f1f77bcf86cd799439011', serviceAreas: [{ postcodePrefix: 'CF' }] };
    mockClinicModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

    const result = await service.updateBasicSettings('507f1f77bcf86cd799439011', update);

    const payload = mockClinicModel.findByIdAndUpdate.mock.calls[0][1];
    expect(payload.serviceAreas).toEqual([{ postcodePrefix: 'CF' }]);
    expect(result).toEqual(updated);
  });

  it('should update businessHours when provided', async () => {
    const update: UpdateClinicSettingsDto = {
      businessHours: [{ day: 'monday', isOpen: true, openTime: '08:00', closeTime: '16:00' }],
    };
    const updated = { _id: '507f1f77bcf86cd799439011', businessHours: update.businessHours };
    mockClinicModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

    await service.updateBasicSettings('507f1f77bcf86cd799439011', update);

    const payload = mockClinicModel.findByIdAndUpdate.mock.calls[0][1];
    expect(payload.businessHours[0].openTime).toBe('08:00');
  });
});
