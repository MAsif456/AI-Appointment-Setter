
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';



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
    /**
     * Mocked ClinicsService method to return all active clinics.
     */
    findAll: jest.Mock,
    /**
     * Mocked ClinicsService method to return a single clinic by ID.
     */
    findById: jest.Mock,
  };

  beforeEach(async () => {
    /**
     * Reset the mocked service layer before running each test.
     * This ensures that the test results are not affected by previous tests.
     */
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
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
});