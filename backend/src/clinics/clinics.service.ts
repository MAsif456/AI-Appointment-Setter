/**
 * Service for basic clinic data retrieval.
 * Provides read-only access to clinic documents for listing and detail views.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from '../schemas/clinic.schema';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
  ) {}

  /**
   * Returns all active clinics with basic summary fields.
   * @returns Array of clinic summary documents
   */
  async findAll() {
    return this.clinicModel
      .find({}, { name: 1, isActive: 1 })
      .lean()
      .exec();
  }

  /**
   * Returns a single clinic by its ID with basic fields.
   * @param clinicId - The MongoDB ObjectId of the clinic
   * @returns The clinic document
   * @throws NotFoundException if the clinic does not exist
   */
  async findById(clinicId: string) {
    const clinic = await this.clinicModel
      .findById(clinicId, { name: 1, isActive: 1 })
      .lean()
      .exec();

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID "${clinicId}" not found`);
    }
    return clinic;
  }
}
