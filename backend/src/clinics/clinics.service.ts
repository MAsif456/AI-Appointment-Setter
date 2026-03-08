/**
 * Service for clinic data operations.
 * Provides read access to clinic documents and clinic creation.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

const VALID_OBJECT_ID = /^[a-f0-9]{24}$/i;

function assertValidObjectId(id: string): void {
  if (
    id == null ||
    id === 'undefined' ||
    typeof id !== 'string' ||
    !VALID_OBJECT_ID.test(id)
  ) {
    throw new BadRequestException('Invalid clinic ID');
  }
}

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
   * Throws ConflictException if a clinic with the same GHL Location ID already exists.
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
   * Validates the ObjectId format before querying.
   * @param id - the document identifier
   * @throws BadRequestException when the id is not a valid 24-char hex string
   * @throws NotFoundException when no clinic matches the given id
   */
  async findById(id: string): Promise<ClinicDocument> {
    assertValidObjectId(id);
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

  /**
   * Applies a partial update to a clinic's basic settings.
   * Only fields that are present in the update payload are written;
   * omitted fields are left unchanged in the database.
   * @throws {BadRequestException} if the id is not a valid 24-char hex string.
   * @throws {NotFoundException} if no clinic with that id exists.
   */
  async updateBasicSettings(
    id: string,
    update: UpdateClinicSettingsDto,
  ): Promise<Clinic> {
    assertValidObjectId(id);
    const {
      name,
      address,
      phone,
      ghlLocationId,
      serviceAreas,
      businessHours,
    } = update;

    const updatePayload: Partial<Clinic> = {};

    if (typeof name === 'string') updatePayload.name = name;
    if (address !== undefined) updatePayload.address = address;
    if (phone !== undefined) updatePayload.phone = phone;
    if (ghlLocationId !== undefined) updatePayload.ghlLocationId = ghlLocationId;
    if (serviceAreas) updatePayload.serviceAreas = serviceAreas;
    if (businessHours) updatePayload.businessHours = businessHours;

    const clinic = await this.clinicModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .exec();

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    return clinic;
  }
}
