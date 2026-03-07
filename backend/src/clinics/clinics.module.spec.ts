
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ClinicsModule } from './clinics.module';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../schemas/clinic.schema';

/**
 * Unit tests for ClinicsModule.
 * Covers the compilation of the module and its ability to resolve the controller and service.
 */
describe('ClinicsModule', () => {
  /**
   * Verifies that the module can be compiled and the controller and service
   * can be resolved.
   */
  it('should compile the module and resolve controller and service', async () => {
    const module = await Test.createTestingModule({
      imports: [ClinicsModule],
    })
      .overrideProvider(getModelToken(Clinic.name))
      .useValue({})
      .compile();

    const controller = module.get<ClinicsController>(ClinicsController);
    const service = module.get<ClinicsService>(ClinicsService);

    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
