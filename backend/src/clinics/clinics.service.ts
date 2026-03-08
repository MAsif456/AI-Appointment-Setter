import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from '../schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';

/**
 * Handles all database operations for clinics.
 * Keeps business logic separate from the controller layer.
 */
@Injectable()
export class ClinicsService {
  constructor(
    @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
  ) {}

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

  /**
   * Returns all clinics, optionally filtered by a case-insensitive name search.
   * @param search - partial clinic name to filter by (optional)
   */
  async findAll(search?: string): Promise<ClinicDocument[]> {
    const filter = search
      ? { name: { $regex: search, $options: 'i' } }
      : {};

    return this.clinicModel.find(filter).sort({ name: 1 }).exec();
  }

  /**
   * Returns a single clinic by its MongoDB _id.
   * @param id - the document identifier
   * @throws NotFoundException when no clinic matches the given id
   */
  async findById(id: string): Promise<ClinicDocument> {
    const clinic = await this.clinicModel.findById(id).exec();
    if (!clinic) {
      throw new NotFoundException(`Clinic with id "${id}" not found`);
    }
    return clinic;
  }

  /**
   * Sets a clinic's isActive flag to false.
   * @param id - the document identifier
   */
  async deactivate(id: string): Promise<ClinicDocument> {
    const clinic = await this.findById(id);
    clinic.isActive = false;
    return clinic.save();
  }

  /**
   * Sets a clinic's isActive flag to true.
   * @param id - the document identifier
   */
  async activate(id: string): Promise<ClinicDocument> {
    const clinic = await this.findById(id);
    clinic.isActive = true;
    return clinic.save();
  }
}
