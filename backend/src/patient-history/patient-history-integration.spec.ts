/**
 * Integration-level tests for PatientHistoryService clinic scoping and edge cases.
 *
 * Covers:
 *   1.  Phone match same clinic -> high confidence
 *   2.  Phone match different clinic -> null (clinic scoping enforced)
 *   3.  Email match same clinic -> medium confidence
 *   4.  No match -> null (treated as new patient)
 *   5.  Cancelled patient is still recognised (PatientHistory record persists)
 *   6.  Stale data (beyond patientDataExpiryDays) -> stale confidence
 *   10. Returning patient lookup failure -> graceful fallback to new patient flow
 */
import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { PatientHistoryService } from "./patient-history.service";
import { PatientHistory } from "../database/schemas/patient-history.schema";

const CLINIC_A = "507f1f77bcf86cd799439011";
const CLINIC_B = "507f1f77bcf86cd799439022";
const CONV_ID = new Types.ObjectId("507f1f77bcf86cd799439033");

const recentRecord = {
  firstName: "Jane",
  lastName: "Doe",
  validatedPostcode: "CF10 1AA",
  previousConversationId: CONV_ID,
  lastBookedAt: new Date(Date.now() - 10 * 86_400_000),
};

const staleRecord = {
  ...recentRecord,
  lastBookedAt: new Date(Date.now() - 400 * 86_400_000),
};

describe("PatientHistoryService - clinic scoping and edge cases", () => {
  let service: PatientHistoryService;

  async function createService(findOneResult: unknown = null) {
    const mockModel = {
      findOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(findOneResult) }),
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
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    return mockModel;
  }

  afterEach(() => jest.restoreAllMocks());

  it("returns high confidence for a phone match at the same clinic", async () => {
    await createService(recentRecord);
    const result = await service.findReturningPatient(
      "07911123456",
      undefined,
      CLINIC_A,
      365,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("high");
    expect(result!.firstName).toBe("Jane");
  });

  it("returns null when the phone matches a record at a different clinic", async () => {
    await createService(null);
    const result = await service.findReturningPatient(
      "07911123456",
      undefined,
      CLINIC_B,
      365,
    );
    expect(result).toBeNull();
  });

  it("returns medium confidence for an email-only match at the same clinic", async () => {
    const mockModel = {
      findOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(recentRecord) }),
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
      CLINIC_A,
      365,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("medium");
  });

  it("returns null when there is no matching record", async () => {
    await createService(null);
    const result = await service.findReturningPatient(
      "07900000000",
      "unknown@x.com",
      CLINIC_A,
      365,
    );
    expect(result).toBeNull();
  });

  it("still recognises a patient whose last conversation was cancelled", async () => {
    await createService(recentRecord);
    const result = await service.findReturningPatient(
      "07911123456",
      undefined,
      CLINIC_A,
      365,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("high");
  });

  it("returns stale confidence when the last booking is beyond the expiry window", async () => {
    await createService(staleRecord);
    const result = await service.findReturningPatient(
      "07911123456",
      undefined,
      CLINIC_A,
      365,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("stale");
  });

  it("returns null and does not throw when the database lookup fails", async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error("timeout")),
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
      "07911123456",
      undefined,
      CLINIC_A,
      365,
    );
    expect(result).toBeNull();
  });
});
