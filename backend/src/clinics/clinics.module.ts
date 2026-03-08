import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Clinic, ClinicSchema } from '../schemas/clinic.schema';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';

/**
 * Feature module that wires up the Clinic Mongoose model,
 * the ClinicsController, and the ClinicsService.
 * This module imports the MongooseModule and configures it to use the ClinicSchema for the Clinic model.
 * It includes the ClinicsController and ClinicsService, and exports the ClinicsService.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Clinic.name, schema: ClinicSchema }]),
  ],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
