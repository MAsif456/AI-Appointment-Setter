import { Body, Controller, Post } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  /**
   * Creates a new clinic based on the provided DTO.
   * @param dto The CreateClinicDto containing the clinic's information.
   * @returns The newly created clinic document.
   */
  create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }
}
