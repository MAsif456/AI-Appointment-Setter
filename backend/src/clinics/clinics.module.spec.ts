import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ClinicsModule } from './clinics.module';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../schemas/clinic.schema';

/**
 * Integration test for ClinicsModule.
 *
 * Verifies that the module compiles and wires the controller
 * and service through NestJS dependency injection.
 */
describe('ClinicsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ClinicsModule],
    })
      .overrideProvider(getModelToken(Clinic.name))
      .useValue({ findOne: jest.fn().mockReturnValue({ lean: jest.fn() }), create: jest.fn() })
      .compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide ClinicsController', () => {
    expect(module.get<ClinicsController>(ClinicsController)).toBeInstanceOf(ClinicsController);
  });

  it('should provide ClinicsService', () => {
    expect(module.get<ClinicsService>(ClinicsService)).toBeInstanceOf(ClinicsService);
  });
});
