import { Test, TestingModule } from '@nestjs/testing';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';

/** Reusable mock clinic object for assertions. */
const mockClinic = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Cardiff Physiotherapy Centre',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  serviceAreas: ['CF', 'NP', 'SA'],
  leads: 12,
  bookings: 5,
  isActive: true,
};

describe('ClinicsController', () => {
  let controller: ClinicsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      deactivate: jest.fn(),
      activate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicsController],
      providers: [{ provide: ClinicsService, useValue: service }],
    }).compile();

    controller = module.get<ClinicsController>(ClinicsController);
  });

  describe('findAll', () => {
    it('should return all clinics without a search query', async () => {
      service.findAll.mockResolvedValue([mockClinic]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([mockClinic]);
    });

    it('should pass the search query to the service', async () => {
      service.findAll.mockResolvedValue([mockClinic]);

      await controller.findAll('Cardiff');

      expect(service.findAll).toHaveBeenCalledWith('Cardiff');
    });
  });

  describe('findById', () => {
    it('should return a single clinic', async () => {
      service.findById.mockResolvedValue(mockClinic);

      const result = await controller.findById('507f1f77bcf86cd799439011');

      expect(service.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockClinic);
    });
  });

  describe('deactivate', () => {
    it('should deactivate the clinic', async () => {
      const deactivated = { ...mockClinic, isActive: false };
      service.deactivate.mockResolvedValue(deactivated);

      const result = await controller.deactivate('507f1f77bcf86cd799439011');

      expect(service.deactivate).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result.isActive).toBe(false);
    });
  });

  describe('activate', () => {
    it('should activate the clinic', async () => {
      service.activate.mockResolvedValue(mockClinic);

      const result = await controller.activate('507f1f77bcf86cd799439011');

      expect(service.activate).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result.isActive).toBe(true);
    });
  });
});
