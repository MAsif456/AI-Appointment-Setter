/**
 * Unit tests for ClinicsService.
 * Covers listing clinics and finding by ID with edge cases.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../schemas/clinic.schema';

/**
 * Unit tests for ClinicsService.
 * Covers listing clinics and finding by ID with edge cases.
 * @see ClinicsService
 */
describe('ClinicsService', () => {
  let service: ClinicsService;
  let execMock: jest.Mock;
  let findByIdExecMock: jest.Mock;
  let mockModel: Record<string, jest.Mock>;

  /**
   * Setup the mocked model, service, and functions before each test.
   * @see ClinicsService
   */
  beforeEach(async () => {
    execMock = jest.fn();
    const leanMock = jest.fn().mockReturnValue({ exec: execMock });
    const findMock = jest.fn().mockReturnValue({ lean: leanMock });

    findByIdExecMock = jest.fn();
    const findByIdLeanMock = jest.fn().mockReturnValue({ exec: findByIdExecMock });
    const findByIdMock = jest.fn().mockReturnValue({ lean: findByIdLeanMock });

    mockModel = { find: findMock, findById: findByIdMock };

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
});
