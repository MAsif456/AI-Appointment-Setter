/**
 * Controller for basic clinic endpoints.
 * Handles listing and individual clinic retrieval.
 */
import { Controller, Get, Param } from '@nestjs/common';
import { ClinicsService } from './clinics.service';

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
}
