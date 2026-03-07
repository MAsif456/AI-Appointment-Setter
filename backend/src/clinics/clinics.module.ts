/**
 * ClinicsModule: NestJS feature module for the clinics domain.
 *
 * Registers the Clinic Mongoose model, exposes the REST endpoints via
 * ClinicsController, and provides ClinicsService to other modules that
 * import this module.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Clinic, ClinicSchema } from '../schemas/clinic.schema';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Clinic.name, schema: ClinicSchema }]),
  ],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}

