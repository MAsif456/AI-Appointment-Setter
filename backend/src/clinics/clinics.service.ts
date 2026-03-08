/**
 * Service for clinic data operations.
 * Provides read access to clinic documents and clinic creation.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from '../schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Injectable()
export class ClinicsService {
  /**
   * Constructor for ClinicsService.
   *
   * @param clinicModel - The Mongoose Model for ClinicDocument.
   */
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

  /**
   * Create a new clinic from a CreateClinicDto.
   *
   * Will throw a ConflictException if a clinic with the same GHL Location ID already exists.
   *
   * @returns A promise that resolves to the newly created ClinicDocument.
   */
  async create(dto: CreateClinicDto): Promise<ClinicDocument> {
    const existing = await this.clinicModel
      .findOne({ ghlLocationId: dto.ghlLocationId })
      .lean();

    if (existing) {
      throw new ConflictException(
        'A clinic with this GHL Location ID already exists',
      );
    }

    return this.clinicModel.create(dto);
  }
}
