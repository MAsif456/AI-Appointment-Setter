import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import type { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  findAll() {
    return this.clinicsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id/settings')
  updateSettings(
    @Param('id') id: string,
    @Body() body: UpdateClinicSettingsDto,
  ) {
    return this.clinicsService.updateBasicSettings(id, body);
  }
}

