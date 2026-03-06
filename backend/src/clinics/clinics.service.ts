import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from '../schemas/clinic.schema';
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

  findAll() {
    return this.clinicModel.find().exec();
  }

  async findOne(id: string) {
    assertValidObjectId(id);
    const clinic = await this.clinicModel.findById(id).exec();
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }
    return clinic;
  }

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

