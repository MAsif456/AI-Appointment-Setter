import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ClinicsService } from './clinics.service';

/**
 * REST controller exposing clinic endpoints.
 * All routes are prefixed with /clinics.
 */
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /**
   * GET /clinics
   * Returns every clinic, optionally filtered by a search query param.
   * @param search - partial name to filter on (case-insensitive)
   */
  @Get()
  findAll(@Query('search') search?: string) {
    return this.clinicsService.findAll(search);
  }

  /**
   * GET /clinics/:id
   * Returns the clinic matching the given id.
   */
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.clinicsService.findById(id);
  }

  /**
   * PATCH /clinics/:id/deactivate
   * Marks the clinic as inactive.
   */
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.clinicsService.deactivate(id);
  }

  /**
   * PATCH /clinics/:id/activate
   * Marks the clinic as active.
   */
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.clinicsService.activate(id);
  }
}
