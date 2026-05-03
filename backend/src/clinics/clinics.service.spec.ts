/**
 * Unit tests for ClinicsService.
 * Covers listing clinics, finding by ID, clinic creation,
 * duplicate GHL Location ID detection, database error propagation,
 * and per-clinic integration management.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ClinicsService } from "./clinics.service";
import { Clinic } from "../database/schemas/clinic.schema";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";
import { EncryptionService } from '../common/encryption/encryption.service';
import { GhlApiService } from '../ghl/ghl-api.service';

/** Helper to build a mock clinic document with a save() method. */
const mockClinic = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  name: "Cardiff Physiotherapy Centre",
  address: "123 Queen Street, Cardiff, CF10 2BX",
  serviceAreas: ["CF", "NP", "SA"],
  leads: 12,
  bookings: 5,
  isActive: true,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const CLINIC_ID = '507f1f77bcf86cd799439011';

describe("ClinicsService", () => {
  let service: ClinicsService;
  let model: Record<string, jest.Mock>;
  let mockEncryption: jest.Mocked<Pick<EncryptionService, 'encrypt' | 'decrypt'>>;
  let mockGhl: jest.Mocked<Pick<GhlApiService, 'testConnectionWithKey'>>;

  const validDto: CreateClinicDto = {
    name: "Test Clinic",
    ghlLocationId: "loc_test_001",
    ghlCalendarId: "cal_test_001",
    address: "123 Test Street, Cardiff, CF10 1AA",
    phone: "029 2034 5678",
    defaultAppointmentDuration: 30,
    serviceAreas: [{ postcodePrefix: "CF" }],
    services: [{ name: "Physiotherapy" }],
    businessHours: [
      { day: "monday", isOpen: true, openTime: "09:00", closeTime: "17:00" },
    ],
  };

  beforeEach(async () => {
    model = {
      find: jest.fn(),
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID, ghlLocationId: 'loc_test_001' }) }),
        exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID }),
      }),
      findByIdAndUpdate: jest.fn(),
      findOne: jest
        .fn()
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue({ ...validDto, _id: "generated_id" }),
    };

    const conversationModel = {
      aggregate: jest.fn().mockResolvedValue([]),
    };

    mockEncryption = {
      encrypt: jest.fn().mockReturnValue('encrypted:auth:cipher'),
      decrypt: jest.fn().mockReturnValue('plaintext-api-key'),
    };

    mockGhl = {
      testConnectionWithKey: jest.fn().mockResolvedValue({ valid: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getModelToken(Clinic.name), useValue: model },
        { provide: getModelToken("Conversation"), useValue: conversationModel },
        { provide: EncryptionService, useValue: mockEncryption },
        { provide: GhlApiService, useValue: mockGhl },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
  });

  describe("create", () => {
    it("should create a clinic with required fields only", async () => {
      const minimalDto: CreateClinicDto = {
        name: "Minimal Clinic",
        ghlLocationId: "loc_minimal_001",
        ghlCalendarId: "cal_minimal_001",
        address: "1 Test Street, Cardiff",
        phone: "029 2034 5678",
        serviceAreas: [{ postcodePrefix: "CF" }],
      };
      model.create.mockResolvedValue({ ...minimalDto, _id: "new_id" });

      const result = await service.create(minimalDto);

      expect(model.findOne).toHaveBeenCalledWith({
        ghlLocationId: "loc_minimal_001",
      });
      expect(model.create).toHaveBeenCalledWith(minimalDto);
      expect(result).toHaveProperty("_id");
    });

    it("should create a clinic with all fields", async () => {
      const result = await service.create(validDto);

      expect(model.create).toHaveBeenCalledWith(validDto);
      expect(result.name).toBe("Test Clinic");
    });

    it("should throw ConflictException for duplicate ghlLocationId", async () => {
      model.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "existing_id" }),
      });

      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
      await expect(service.create(validDto)).rejects.toThrow(
        "A clinic with this GHL Location ID already exists",
      );
      expect(model.create).not.toHaveBeenCalled();
    });

    it("should propagate database errors from create", async () => {
      model.create.mockRejectedValue(new Error("DB connection lost"));

      await expect(service.create(validDto)).rejects.toThrow(
        "DB connection lost",
      );
    });

    it("should propagate database errors from findOne", async () => {
      model.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error("Query timeout")),
      });

      await expect(service.create(validDto)).rejects.toThrow("Query timeout");
    });
  });

  describe("findAll", () => {
    it("should return all clinics when no search term is provided", async () => {
      const clinics = [mockClinic()];
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue(clinics) }),
        }),
      });

      const result = await service.findAll();

      expect(model.find).toHaveBeenCalledWith({});
      expect(result).toEqual(
        clinics.map((c) => ({ ...c, todayLeadsCount: 0, todayBookingsCount: 0 })),
      );
    });

    it("should filter clinics by name when a search term is provided", async () => {
      const clinics = [mockClinic()];
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue(clinics) }),
        }),
      });

      const result = await service.findAll("Cardiff");

      expect(model.find).toHaveBeenCalledWith({
        name: { $regex: "Cardiff", $options: "i" },
      });
      expect(result).toEqual(
        clinics.map((c) => ({ ...c, todayLeadsCount: 0, todayBookingsCount: 0 })),
      );
    });

    it("should escape regex metacharacters in the search term to block NoSQL/ReDoS injection", async () => {
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      });

      // Attacker tries to dump the entire collection with `.*` and to
      // trigger catastrophic backtracking with `(a+)+`.
      await service.findAll(".*");
      expect(model.find).toHaveBeenCalledWith({
        name: { $regex: "\\.\\*", $options: "i" },
      });

      await service.findAll("(a+)+");
      expect(model.find).toHaveBeenCalledWith({
        name: { $regex: "\\(a\\+\\)\\+", $options: "i" },
      });
    });

    it("should treat an empty search string as no-filter rather than match-all", async () => {
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      });
      await service.findAll("");
      expect(model.find).toHaveBeenCalledWith({});
    });

    it("should return an empty array when no clinics exist", async () => {
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      });

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return the clinic when it exists", async () => {
      const clinic = mockClinic();
      model.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(clinic),
      });

      const result = await service.findById("507f1f77bcf86cd799439011");

      expect(result).toEqual(clinic);
    });

    it("should throw BadRequestException for an invalid ID format", async () => {
      await expect(service.findById("not-an-id")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException for an undefined ID string", async () => {
      await expect(service.findById("undefined")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject uppercase-hex ObjectIds (case-sensitive guard)", async () => {
      // 24-char hex but uppercase — would pass the old /i regex and then
      // throw a Mongoose CastError at query time. Now caught at the boundary.
      await expect(
        service.findById("AABBCCDDEEFF001122334455"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when clinic does not exist", async () => {
      model.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findById("507f1f77bcf86cd799439011"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deactivate", () => {
    it("should set isActive to false and save", async () => {
      const clinic = mockClinic({ isActive: true });
      clinic.save.mockResolvedValue({ ...clinic, isActive: false });
      model.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(clinic),
      });

      const result = await service.deactivate("507f1f77bcf86cd799439011");

      expect(clinic.isActive).toBe(false);
      expect(clinic.save).toHaveBeenCalled();
      expect(result).toEqual({ ...clinic, isActive: false });
    });
  });

  describe("activate", () => {
    it("should set isActive to true and save", async () => {
      const clinic = mockClinic({ isActive: false });
      clinic.save.mockResolvedValue({ ...clinic, isActive: true });
      model.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(clinic),
      });

      const result = await service.activate("507f1f77bcf86cd799439011");

      expect(clinic.isActive).toBe(true);
      expect(clinic.save).toHaveBeenCalled();
      expect(result).toEqual({ ...clinic, isActive: true });
    });
  });

  describe("findByGhlLocationId", () => {
    it("should return the clinic when the locationId matches", async () => {
      const clinic = mockClinic();
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(clinic),
      });

      const result = await service.findByGhlLocationId("loc_cardiff_001");

      expect(model.findOne).toHaveBeenCalledWith({
        ghlLocationId: "loc_cardiff_001",
      });
      expect(result).toEqual(clinic);
    });

    it("should throw NotFoundException when no clinic matches the locationId", async () => {
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findByGhlLocationId("loc_unknown")).rejects.toThrow(
        'Clinic with GHL locationId "loc_unknown" not found',
      );
    });
  });

  describe("updateBasicSettings", () => {
    it("should update a clinic and return the saved document", async () => {
      const update: UpdateClinicSettingsDto = { name: "New Name" };
      const updated = { _id: "507f1f77bcf86cd799439011", name: "New Name" };
      model.findByIdAndUpdate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateBasicSettings(
        "507f1f77bcf86cd799439011",
        update,
      );

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        expect.objectContaining({ name: "New Name" }),
        { returnDocument: 'after' },
      );
      expect(result).toEqual(updated);
    });

    it("should only include defined fields in the update payload", async () => {
      const update: UpdateClinicSettingsDto = { name: "Only Name" };
      model.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439011",
          name: "Only Name",
        }),
      });

      await service.updateBasicSettings("507f1f77bcf86cd799439011", update);

      const payload = model.findByIdAndUpdate.mock.calls[0][1];
      expect(payload).not.toHaveProperty("address");
      expect(payload).not.toHaveProperty("phone");
    });

    it("should throw BadRequestException for invalid ID in updateBasicSettings", async () => {
      await expect(
        service.updateBasicSettings("bad-id", { name: "X" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when the clinic to update does not exist", async () => {
      model.findByIdAndUpdate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        service.updateBasicSettings("507f1f77bcf86cd799439011", { name: "X" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update serviceAreas when provided", async () => {
      const update: UpdateClinicSettingsDto = {
        serviceAreas: [{ postcodePrefix: "CF" }],
      };
      const updated = {
        _id: "507f1f77bcf86cd799439011",
        serviceAreas: [{ postcodePrefix: "CF" }],
      };
      model.findByIdAndUpdate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateBasicSettings(
        "507f1f77bcf86cd799439011",
        update,
      );

      const payload = model.findByIdAndUpdate.mock.calls[0][1];
      expect(payload.serviceAreas).toEqual([{ postcodePrefix: "CF" }]);
      expect(result).toEqual(updated);
    });

    it("should update businessHours when provided", async () => {
      const update: UpdateClinicSettingsDto = {
        businessHours: [
          {
            day: "monday",
            isOpen: true,
            openTime: "08:00",
            closeTime: "16:00",
          },
        ],
      };
      const updated = {
        _id: "507f1f77bcf86cd799439011",
        businessHours: update.businessHours,
      };
      model.findByIdAndUpdate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      await service.updateBasicSettings("507f1f77bcf86cd799439011", update);

      const payload = model.findByIdAndUpdate.mock.calls[0][1];
      expect(payload.businessHours[0].openTime).toBe("08:00");
    });
  });

  // ─── updateIntegrations ───────────────────────────────────────────────────

  describe('updateIntegrations', () => {
    it('throws BadRequestException when GHL rejects the API key', async () => {
      mockGhl.testConnectionWithKey.mockResolvedValue({ valid: false });

      await expect(
        service.updateIntegrations(CLINIC_ID, 'bad-key'),
      ).rejects.toThrow(BadRequestException);
      expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('throws BadRequestException with descriptive message on invalid key', async () => {
      mockGhl.testConnectionWithKey.mockResolvedValue({ valid: false });

      await expect(
        service.updateIntegrations(CLINIC_ID, 'bad-key'),
      ).rejects.toThrow('Could not connect to GoHighLevel');
    });

    it('encrypts the API key before storing', async () => {
      mockGhl.testConnectionWithKey.mockResolvedValue({ valid: true });
      model.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID }),
      });

      await service.updateIntegrations(CLINIC_ID, 'valid-api-key');

      expect(mockEncryption.encrypt).toHaveBeenCalledWith('valid-api-key');
      const payload = model.findByIdAndUpdate.mock.calls[0][1];
      expect(payload.ghlApiKey).toBe('encrypted:auth:cipher');
      expect(payload.ghlApiKey).not.toBe('valid-api-key');
    });

    it('sets isActive to true on success', async () => {
      mockGhl.testConnectionWithKey.mockResolvedValue({ valid: true });
      model.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID }),
      });

      await service.updateIntegrations(CLINIC_ID, 'valid-api-key');

      const payload = model.findByIdAndUpdate.mock.calls[0][1];
      expect(payload.isActive).toBe(true);
    });

    it('persists webhookUrl when provided', async () => {
      mockGhl.testConnectionWithKey.mockResolvedValue({ valid: true });
      model.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID }),
      });

      await service.updateIntegrations(CLINIC_ID, 'valid-api-key', 'https://example.com/wh');

      const payload = model.findByIdAndUpdate.mock.calls[0][1];
      expect(payload.webhookUrl).toBe('https://example.com/wh');
    });

    it('throws NotFoundException when the clinic does not exist', async () => {
      mockGhl.testConnectionWithKey.mockResolvedValue({ valid: true });
      model.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateIntegrations(CLINIC_ID, 'valid-api-key'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for an invalid clinic ID format', async () => {
      await expect(
        service.updateIntegrations('bad-id', 'valid-api-key'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── testClinicConnection ─────────────────────────────────────────────────

  describe('testClinicConnection', () => {
    it('returns { connected: false } when no API key is stored', async () => {
      model.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID }) }),
      });

      const result = await service.testClinicConnection(CLINIC_ID);
      expect(result).toEqual({ connected: false });
    });

    it('returns { connected: true } when the stored key is accepted', async () => {
      model.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID, ghlApiKey: 'encrypted:auth:cipher' }),
        }),
      });
      mockGhl.testConnectionWithKey.mockResolvedValue({ valid: true });

      const result = await service.testClinicConnection(CLINIC_ID);
      expect(result).toEqual({ connected: true });
      expect(mockEncryption.decrypt).toHaveBeenCalledWith('encrypted:auth:cipher');
    });

    it('returns { connected: false } when the stored key is rejected', async () => {
      model.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID, ghlApiKey: 'encrypted:auth:cipher' }),
        }),
      });
      mockGhl.testConnectionWithKey.mockResolvedValue({ valid: false });

      const result = await service.testClinicConnection(CLINIC_ID);
      expect(result).toEqual({ connected: false });
    });

    it('returns { connected: false } when decryption throws', async () => {
      model.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID, ghlApiKey: 'bad' }),
        }),
      });
      mockEncryption.decrypt.mockImplementation(() => { throw new Error('bad data'); });

      const result = await service.testClinicConnection(CLINIC_ID);
      expect(result).toEqual({ connected: false });
    });
  });

  // ─── disconnectIntegration ────────────────────────────────────────────────

  describe('disconnectIntegration', () => {
    it('unsets ghlApiKey and webhookUrl and sets isActive to false', async () => {
      model.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });

      await service.disconnectIntegration(CLINIC_ID);

      const [, updateArg] = model.findByIdAndUpdate.mock.calls[0];
      expect(updateArg.$unset).toMatchObject({ ghlApiKey: '', webhookUrl: '' });
      expect(updateArg.isActive).toBe(false);
    });

    it('throws BadRequestException for an invalid ID format', async () => {
      await expect(service.disconnectIntegration('not-an-id')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getDecryptedApiKey ───────────────────────────────────────────────────

  describe('getDecryptedApiKey', () => {
    it('returns the decrypted plaintext key', async () => {
      model.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID, ghlApiKey: 'encrypted:auth:cipher' }),
        }),
      });

      const result = await service.getDecryptedApiKey(CLINIC_ID);
      expect(result).toBe('plaintext-api-key');
      expect(mockEncryption.decrypt).toHaveBeenCalledWith('encrypted:auth:cipher');
    });

    it('throws NotFoundException when no API key is configured', async () => {
      model.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: CLINIC_ID }),
        }),
      });

      await expect(service.getDecryptedApiKey(CLINIC_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── maskApiKey ───────────────────────────────────────────────────────────

  describe('maskApiKey', () => {
    it('returns empty string when no key is provided', () => {
      expect(service.maskApiKey('')).toBe('');
    });

    it('returns masked key with last 6 chars of the decrypted value', () => {
      mockEncryption.decrypt.mockReturnValue('super-secret-abc123');
      const result = service.maskApiKey('encrypted:auth:cipher');
      expect(result).toBe('••••••••••••abc123');
    });

    it('returns fallback mask if decryption fails', () => {
      mockEncryption.decrypt.mockImplementation(() => { throw new Error('bad'); });
      const result = service.maskApiKey('bad-data');
      expect(result).toBe('••••••••••••');
    });
  });
});
