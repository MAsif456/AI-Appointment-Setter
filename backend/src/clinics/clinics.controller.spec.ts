import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

/**
 * Unit tests for ClinicsController.
 *
 * Verifies that the controller delegates to the service and
 * propagates both successful results and exceptions correctly.
 */
describe('ClinicsController', () => {
  let controller: ClinicsController;
  let mockService: { create: jest.Mock; findAll: jest.Mock; findOne: jest.Mock; updateBasicSettings: jest.Mock };

  const validDto: CreateClinicDto = {
    name: 'Cardiff Physio',
    ghlLocationId: 'loc_cardiff_001',
    ghlCalendarId: 'cal_cardiff_001',
  };

  beforeEach(async () => {
    mockService = {
      create: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
      updateBasicSettings: jest.fn().mockResolvedValue({ ...validDto, _id: 'abc123' }),
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

  // findAll

  it('should call clinicsService.findAll and return all clinics', async () => {
    const clinics = [{ _id: '1', name: 'Clinic A' }, { _id: '2', name: 'Clinic B' }];
    mockService.findAll.mockResolvedValue(clinics);

    const result = await controller.findAll();

    expect(mockService.findAll).toHaveBeenCalled();
    expect(result).toEqual(clinics);
  });

  it('should return an empty array when no clinics exist', async () => {
    mockService.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  it('should propagate errors from findAll', async () => {
    mockService.findAll.mockRejectedValue(new Error('DB error'));

    await expect(controller.findAll()).rejects.toThrow('DB error');
  });

  // findOne

  it('should call clinicsService.findOne with the provided id', async () => {
    const clinic = { _id: '507f1f77bcf86cd799439011', name: 'Cardiff Physio' };
    mockService.findOne.mockResolvedValue(clinic);

    const result = await controller.findOne('507f1f77bcf86cd799439011');

    expect(mockService.findOne).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(result).toEqual(clinic);
  });

  it('should propagate BadRequestException from findOne', async () => {
    mockService.findOne.mockRejectedValue(new BadRequestException('Invalid clinic ID'));

    await expect(controller.findOne('bad-id')).rejects.toThrow(BadRequestException);
  });

  it('should propagate NotFoundException from findOne', async () => {
    mockService.findOne.mockRejectedValue(new NotFoundException('Clinic not found'));

    await expect(controller.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
  });

  // updateSettings

  it('should call clinicsService.updateBasicSettings and return the updated clinic', async () => {
    const body: UpdateClinicSettingsDto = { name: 'Updated Name' };
    const updated = { ...validDto, _id: 'abc123', name: 'Updated Name' };
    mockService.updateBasicSettings.mockResolvedValue(updated);

    const result = await controller.updateSettings('abc123', body);

    expect(mockService.updateBasicSettings).toHaveBeenCalledWith('abc123', body);
    expect(result).toEqual(updated);
  });

  it('should propagate BadRequestException from updateSettings', async () => {
    mockService.updateBasicSettings.mockRejectedValue(new BadRequestException('Invalid clinic ID'));

    await expect(controller.updateSettings('bad-id', {})).rejects.toThrow(BadRequestException);
  });

  it('should propagate NotFoundException from updateSettings', async () => {
    mockService.updateBasicSettings.mockRejectedValue(new NotFoundException('Clinic not found'));

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
    mockService.updateBasicSettings.mockResolvedValue({ _id: 'abc123', ...body });

    await controller.updateSettings('abc123', body);

    expect(mockService.updateBasicSettings).toHaveBeenCalledWith('abc123', body);
  });
});
