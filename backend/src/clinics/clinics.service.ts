import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from '../schemas/clinic.schema';
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

  /** Returns all clinic documents from the database. */
  findAll() {
    return this.clinicModel.find().exec();
  }

  /**
   * Returns a single clinic by its MongoDB ObjectId.
   * @throws {BadRequestException} if the id is not a valid 24-char hex string.
   * @throws {NotFoundException} if no clinic with that id exists.
   */
  async findOne(id: string) {
    assertValidObjectId(id);
    const clinic = await this.clinicModel.findById(id).exec();
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }
    return clinic;
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
