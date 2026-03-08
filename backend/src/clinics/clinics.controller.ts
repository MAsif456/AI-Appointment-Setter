/**
 * Controller for clinic endpoints.
 * Handles listing, individual clinic retrieval, and clinic creation.
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Controller('api/clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /** Returns all clinics with basic summary fields. */
  @Get()
  async findAll() {
    return this.clinicsService.findAll();
  }

  /** Returns a single clinic by its MongoDB ObjectId. */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.clinicsService.findById(id);
  }

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
