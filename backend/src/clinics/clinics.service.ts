/**
 * Service for clinic data operations.
 * Provides read access to clinic documents and clinic creation.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Clinic, ClinicDocument } from "../database/schemas/clinic.schema";
import {
  Conversation,
  ConversationDocument,
} from "../database/schemas/conversation.schema";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";
import { EncryptionService } from '../common/encryption/encryption.service';
import { GhlApiService } from '../ghl/ghl-api.service';

const VALID_OBJECT_ID = /^[a-f0-9]{24}$/i;

function assertValidObjectId(id: string): void {
  if (
    id == null ||
    id === "undefined" ||
    typeof id !== "string" ||
    !VALID_OBJECT_ID.test(id)
  ) {
    throw new BadRequestException("Invalid clinic ID");
  }
}

/**
 * Handles all database operations for clinics.
 * Keeps business logic separate from the controller layer.
 */
@Injectable()
export class ClinicsService {
  constructor(
    @InjectModel(Clinic.name)
    private readonly clinicModel: Model<ClinicDocument>,
    private readonly encryptionService: EncryptionService,
    private readonly ghlApiService: GhlApiService,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
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
        "A clinic with this GHL Location ID already exists",
      );
    }

    return this.clinicModel.create(dto);
  }

  /**
   * Returns all clinics, optionally filtered by a case-insensitive name search.
   * @param search - partial clinic name to filter by (optional)
   */
  async findAll(search?: string): Promise<any[]> {
    const filter = search ? { name: { $regex: search, $options: "i" } } : {};
    const clinics = await this.clinicModel.find(filter).sort({ name: 1 }).lean().exec();

    // Compute live "last 7 days" lead and booking counts per clinic so
    // the clinic cards reflect real activity rather than the static
    // seeded `todayLeadsCount`/`todayBookingsCount`. Done in one
    // aggregation rather than N queries.
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const counts = await this.conversationModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$clinicId",
          leads: { $sum: 1 },
          bookings: {
            $sum: {
              $cond: [{ $in: ["$phase", ["booked", "confirmed"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    const byId = new Map<string, { leads: number; bookings: number }>();
    for (const row of counts) {
      byId.set(row._id.toString(), { leads: row.leads, bookings: row.bookings });
    }

    return clinics.map((clinic) => {
      const c = byId.get((clinic._id as any).toString()) ?? { leads: 0, bookings: 0 };
      return {
        ...clinic,
        todayLeadsCount: c.leads,
        todayBookingsCount: c.bookings,
      };
    });
  }

  /**
   * Returns a single clinic by its MongoDB _id.
   * Validates the ObjectId format before querying.
   * @param id - the document identifier
   * @throws BadRequestException when the id is not a valid 24-char hex string
   * @throws NotFoundException when no clinic matches the given id
   */
  async findByGhlLocationId(locationId: string): Promise<ClinicDocument> {
    const clinic = await this.clinicModel
      .findOne({ ghlLocationId: locationId })
      .exec();
    if (!clinic) {
      throw new NotFoundException(
        `Clinic with GHL locationId "${locationId}" not found`,
      );
    }
    return clinic;
  }

  /**
   * Finds a single clinic by its MongoDB _id.
   * Validates the ObjectId format before querying.
   * @param id - the document identifier
   * @throws BadRequestException when the id is not a valid 24-char hex string
   * @throws NotFoundException when no clinic matches the given id
   * @returns The clinic document matching the given id.
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
    const { name, address, phone, ghlLocationId, serviceAreas, businessHours } =
      update;

    const updatePayload: Partial<Clinic> = {};

    if (typeof name === "string") updatePayload.name = name;
    if (address !== undefined) updatePayload.address = address;
    if (phone !== undefined) updatePayload.phone = phone;
    if (ghlLocationId !== undefined)
      updatePayload.ghlLocationId = ghlLocationId;
    if (serviceAreas) updatePayload.serviceAreas = serviceAreas;
    if (businessHours) updatePayload.businessHours = businessHours;

    const clinic = await this.clinicModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .exec();

    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    return clinic;
  }

  // ---------------------------------------------------------------------------
  // Integration management
  // ---------------------------------------------------------------------------

  /**
   * Validates, encrypts, and persists a per-clinic GHL API key.
   * The key is tested against the GHL API before storage; an invalid key
   * results in a 400 Bad Request.
   *
   * @param clinicId  - MongoDB ObjectId of the clinic.
   * @param apiKey    - Plaintext GHL private integration token.
   * @param webhookUrl - Optional HTTPS webhook delivery URL.
   * @throws BadRequestException if the key fails GHL validation.
   * @throws NotFoundException if the clinic does not exist.
   */
  async updateIntegrations(
    clinicId: string,
    apiKey: string,
    webhookUrl?: string,
  ): Promise<void> {
    assertValidObjectId(clinicId);

    // Fetch the clinic first to get its ghlLocationId — PITs are location-scoped
    // and GHL requires the locationId to validate them.
    const clinic = await this.clinicModel.findById(clinicId).lean().exec();
    if (!clinic) throw new NotFoundException(`Clinic with id "${clinicId}" not found`);

    const result = await this.ghlApiService.testConnectionWithKey(apiKey, clinic.ghlLocationId);
    if (!result.valid) {
      throw new BadRequestException(result.errorMessage ?? 'Could not connect to GoHighLevel. Please check your API key.');
    }

    const encryptedKey = this.encryptionService.encrypt(apiKey);
    const updatePayload: Partial<Clinic> = {
      ghlApiKey: encryptedKey,
      isActive: true,
    };
    if (webhookUrl !== undefined) updatePayload.webhookUrl = webhookUrl;

    const updated = await this.clinicModel
      .findByIdAndUpdate(clinicId, updatePayload, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Clinic with id "${clinicId}" not found`);
    }

    console.log(`[updateIntegrations] saved — clinicId=${clinicId} hasKey=${!!updated.ghlApiKey}`);
  }

  /**
   * Tests the stored encrypted API key against the GHL API.
   *
   * @param clinicId - MongoDB ObjectId of the clinic.
   * @returns `{ connected: true }` if the key is valid, `{ connected: false }` otherwise.
   */
  async testClinicConnection(clinicId: string): Promise<{ connected: boolean }> {
    assertValidObjectId(clinicId);
    const clinic = await this.clinicModel.findById(clinicId).lean().exec();
    if (!clinic?.ghlApiKey) return { connected: false };

    try {
      const plainKey = this.encryptionService.decrypt(clinic.ghlApiKey);
      const result = await this.ghlApiService.testConnectionWithKey(plainKey, clinic.ghlLocationId);
      return { connected: result.valid };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Clears the per-clinic GHL API key and webhook URL and marks the clinic inactive.
   *
   * @param clinicId - MongoDB ObjectId of the clinic.
   */
  async disconnectIntegration(clinicId: string): Promise<void> {
    assertValidObjectId(clinicId);
    await this.clinicModel
      .findByIdAndUpdate(clinicId, {
        $unset: { ghlApiKey: '', webhookUrl: '' },
        isActive: false,
      })
      .exec();
  }

  /**
   * Decrypts and returns the plaintext GHL API key for a clinic.
   * Intended for internal use only (webhooks, background jobs).
   *
   * @param clinicId - MongoDB ObjectId of the clinic.
   * @throws NotFoundException if no API key is configured for this clinic.
   */
  async getDecryptedApiKey(clinicId: string): Promise<string> {
    assertValidObjectId(clinicId);
    const clinic = await this.clinicModel.findById(clinicId).lean().exec();
    if (!clinic?.ghlApiKey) {
      throw new NotFoundException(`No API key configured for clinic "${clinicId}"`);
    }
    return this.encryptionService.decrypt(clinic.ghlApiKey);
  }

  /**
   * Returns a display-safe masked version of the stored encrypted API key.
   * Shows only the last 6 characters of the plaintext key.
   *
   * @param encryptedKey - The stored encrypted key string.
   * @returns A masked string like "••••••••••••abc123", or empty string if no key.
   */
  maskApiKey(encryptedKey: string): string {
    if (!encryptedKey) return '';
    try {
      const plain = this.encryptionService.decrypt(encryptedKey);
      const last6 = plain.slice(-6);
      return `••••••••••••${last6}`;
    } catch {
      return '••••••••••••';
    }
  }
}
