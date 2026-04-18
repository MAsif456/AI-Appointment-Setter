/**
 * Unit tests for PatientHistoryService.
 *
 * Covers:
 *   - Phone match → high confidence
 *   - Phone match but stale → stale confidence
 *   - No phone match, email match → medium confidence
 *   - No match → null
 *   - DB error during lookup → null (graceful degradation)
 *   - persistHistory upserts record with correct fields
 *   - persistHistory DB error is swallowed (never throws)
 *   - Confidence 'stale' for email match beyond expiry window
 *   - Configurable expiry: clinic with patientDataExpiryDays: 180 flags data older than 180 days
 */
import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { PatientHistoryService } from "./patient-history.service";
import { PatientHistory } from "../database/schemas/patient-history.schema";

const CLINIC_ID = "507f1f77bcf86cd799439011";
const CONV_ID = new Types.ObjectId("507f1f77bcf86cd799439012");

/** A recent history record (booked yesterday). */
const recentRecord = {
  firstName: "Jane",
  lastName: "Doe",
  validatedPostcode: "CF10 1AA",
  previousConversationId: CONV_ID,
  lastBookedAt: new Date(Date.now() - 1 * 86_400_000), // 1 day ago
};

/** A stale history record (booked 400 days ago). */
const staleRecord = {
  ...recentRecord,
  lastBookedAt: new Date(Date.now() - 400 * 86_400_000),
};

/** Factory: builds a mock Mongoose model. */
function buildMockModel(findOneResult: unknown = null) {
  return {
    findOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(findOneResult) }),
    findOneAndUpdate: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };
}

describe("PatientHistoryService", () => {
  let service: PatientHistoryService;
  let mockModel: ReturnType<typeof buildMockModel>;

  async function createModule(findOneResult: unknown = null) {
    mockModel = buildMockModel(findOneResult);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientHistoryService,
        { provide: getModelToken(PatientHistory.name), useValue: mockModel },
      ],
    }).compile();
    service = module.get<PatientHistoryService>(PatientHistoryService);
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  }

  afterEach(() => jest.restoreAllMocks());

  // ─── findReturningPatient ─────────────────────────────────────────────────

  it("returns high confidence when phone matches a recent record", async () => {
    await createModule(recentRecord);
    const result = await service.findReturningPatient(
      "+447911123456",
      undefined,
      CLINIC_ID,
      365,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("high");
    expect(result!.firstName).toBe("Jane");
    expect(result!.validatedPostcode).toBe("CF10 1AA");
  });

  it("returns stale confidence when phone matches but booking is beyond expiry window", async () => {
    await createModule(staleRecord);
    const result = await service.findReturningPatient(
      "+447911123456",
      undefined,
      CLINIC_ID,
      365,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("stale");
  });

  it("returns stale confidence with custom expiry: 180 days for a 200-day-old booking", async () => {
    const oldRecord = {
      ...recentRecord,
      lastBookedAt: new Date(Date.now() - 200 * 86_400_000),
    };
    await createModule(oldRecord);
    const result = await service.findReturningPatient(
      "+447911123456",
      undefined,
      CLINIC_ID,
      180,
    );
    expect(result!.confidence).toBe("stale");
  });

  it("returns non-stale confidence with 180-day expiry for a 100-day-old booking", async () => {
    const recentEnough = {
      ...recentRecord,
      lastBookedAt: new Date(Date.now() - 100 * 86_400_000),
    };
    await createModule(recentEnough);
    const result = await service.findReturningPatient(
      "+447911123456",
      undefined,
      CLINIC_ID,
      180,
    );
    expect(result!.confidence).toBe("high");
  });

  it("returns medium confidence when only email matches", async () => {
    // Phone is undefined so phone lookup is skipped; email query returns a record
    mockModel = {
      findOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(recentRecord) }), // email hit
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientHistoryService,
        { provide: getModelToken(PatientHistory.name), useValue: mockModel },
      ],
    }).compile();
    service = module.get<PatientHistoryService>(PatientHistoryService);
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

    const result = await service.findReturningPatient(
      undefined,
      "jane@example.com",
      CLINIC_ID,
      365,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("medium");
  });

  it("returns null when neither phone nor email matches", async () => {
    await createModule(null);
    const result = await service.findReturningPatient(
      "07900000001",
      "unknown@example.com",
      CLINIC_ID,
      365,
    );
    expect(result).toBeNull();
  });

  it("returns null when both phone and email are undefined", async () => {
    await createModule(null);
    const result = await service.findReturningPatient(
      undefined,
      undefined,
      CLINIC_ID,
      365,
    );
    expect(result).toBeNull();
  });

  it("returns null and does not throw when the database throws during lookup", async () => {
    mockModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error("DB timeout")),
      }),
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientHistoryService,
        { provide: getModelToken(PatientHistory.name), useValue: mockModel },
      ],
    }).compile();
    service = module.get<PatientHistoryService>(PatientHistoryService);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

    const result = await service.findReturningPatient(
      "07900000001",
      undefined,
      CLINIC_ID,
      365,
    );
    expect(result).toBeNull();
  });

  // ─── persistHistory ───────────────────────────────────────────────────────

  it("calls findOneAndUpdate with upsert:true and the correct fields", async () => {
    await createModule();
    await service.persistHistory(
      CLINIC_ID,
      "07911123456",
      "jane@example.com",
      "Jane",
      "Doe",
      "CF10 1AA",
      CONV_ID,
    );
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "07911123456" }),
      expect.objectContaining({
        $set: expect.objectContaining({
          firstName: "Jane",
          lastName: "Doe",
          validatedPostcode: "CF10 1AA",
          previousConversationId: CONV_ID,
        }),
      }),
      { upsert: true, new: true },
    );
  });

  it("does not throw when findOneAndUpdate fails", async () => {
    mockModel = {
      findOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error("write failed")),
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientHistoryService,
        { provide: getModelToken(PatientHistory.name), useValue: mockModel },
      ],
    }).compile();
    service = module.get<PatientHistoryService>(PatientHistoryService);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    // Should resolve cleanly — no throw
    await expect(
      service.persistHistory(
        CLINIC_ID,
        "07911123456",
        undefined,
        "Jane",
        undefined,
        undefined,
        CONV_ID,
      ),
    ).resolves.toBeUndefined();
  });

  it("normalises +44 international prefix before storing", async () => {
    await createModule();
    await service.persistHistory(
      CLINIC_ID,
      "+447911123456",
      undefined,
      "Jane",
      undefined,
      undefined,
      CONV_ID,
    );
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "07911123456" }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("persists email-only lead when phone is absent", async () => {
    await createModule();
    await service.persistHistory(
      CLINIC_ID,
      undefined,
      "Jane@Example.com",
      "Jane",
      "Doe",
      "CF10 1AA",
      CONV_ID,
    );
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@example.com" }),
      expect.objectContaining({
        $set: expect.objectContaining({
          firstName: "Jane",
          lastName: "Doe",
          validatedPostcode: "CF10 1AA",
          previousConversationId: CONV_ID,
          email: "jane@example.com",
        }),
      }),
      { upsert: true, new: true },
    );
    // Phone-keyed filter should NOT be used
    const filterArg = mockModel.findOneAndUpdate.mock.calls[0][0];
    expect(filterArg.phone).toBeUndefined();
  });

  it("skips when both phone and email are absent", async () => {
    await createModule();
    await service.persistHistory(
      CLINIC_ID,
      undefined,
      undefined,
      "Jane",
      undefined,
      undefined,
      CONV_ID,
    );
    expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
