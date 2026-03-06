import { ConflictException, Injectable } from '@nestjs/common';
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
    @InjectModel(Clinic.name) private clinicModel: Model<ClinicDocument>,
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
}
