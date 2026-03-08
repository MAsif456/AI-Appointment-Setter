import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Clinic, ClinicSchema } from './schemas/clinic.schema';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';

/**
 * Feature module that wires up the Clinic Mongoose model,
 * the ClinicsController, and the ClinicsService.
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
