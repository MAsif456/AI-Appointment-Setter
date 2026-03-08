/**
 * Controller for clinic endpoints.
 * Handles listing, individual clinic retrieval, and clinic creation.
 */
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import type { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

/**
 * REST controller exposing clinic endpoints.
 * All routes are prefixed with /clinics.
 */
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /**
   * POST /clinics
   * Creates a new clinic based on the provided DTO.
   * @param dto The CreateClinicDto containing the clinic's information.
   * @returns The newly created clinic document.
   */
  @Post()
  create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }

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
   * Returns a single clinic by its MongoDB ObjectId.
   * Throws 400 if the ID format is invalid, 404 if no clinic is found.
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

  /**
   * PATCH /clinics/:id/settings
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
