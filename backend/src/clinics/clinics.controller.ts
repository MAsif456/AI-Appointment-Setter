import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import type { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /** Returns every clinic in the database. */
  @Get()
  findAll() {
    return this.clinicsService.findAll();
  }

  /**
   * Returns a single clinic by its MongoDB ObjectId.
   * Throws 400 if the ID format is invalid, 404 if no clinic is found.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clinicsService.findOne(id);
  }

  /**
   * Partially updates a clinic's basic settings.
   * Only fields present in the request body are applied.
   * Throws 400 for an invalid ID, 404 if the clinic does not exist.
   */
  @Patch(':id/settings')
  updateSettings(
    @Param('id') id: string,
    @Body() body: UpdateClinicSettingsDto,
  ) {
    return this.clinicsService.updateBasicSettings(id, body);
  }
}

