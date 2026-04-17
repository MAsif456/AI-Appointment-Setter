/**
 * Unit tests for handleReentryForTerminalConversation().
 *
 * Covers: returning patient match, no match, DB error fallback, lead not found,
 * postcode storage, stale confidence, and idempotency.
 */
import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { handleReentryForTerminalConversation, ReentryDeps } from "./orchestrator.reentry";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { FALLBACK_AI_UNAVAILABLE } from "./orchestrator.types";

const clinicConfig: ClinicConfig = {
  clinicId: "507f1f77bcf86cd799439013",
  name: "Cardiff Physiotherapy Centre",
  tone: "Friendly",
  serviceAreas: ["CF", "NP"],
  ghlLocationId: "loc_cardiff_001",
  isActive: true,
};

const mockConversationId = new Types.ObjectId("507f1f77bcf86cd799439011");
const mockLeadId = new Types.ObjectId("507f1f77bcf86cd799439012");
const mockPreviousConvId = new Types.ObjectId("507f1f77bcf86cd799439099");

const buildMockConversation = (phase = "booked") =>
  ({
    _id: mockConversationId,
    leadId: mockLeadId,
    ghlContactId: "contact_001",
    ghlConversationId: "conv_001",
    clinicId: new Types.ObjectId(clinicConfig.clinicId),
    phase,
    channel: "email",
  }) as any;

const mockLead = {
  _id: mockLeadId,
  phone: "07700 900123",
  email: "sarah@example.com",
  firstName: "Sarah",
  lastName: "Williams",
};

const mockReturningPatient = {
  firstName: "Sarah",
  lastName: "Williams",
  validatedPostcode: "CF10 1AA",
  previousConversationId: mockPreviousConvId,
  lastBookedAt: new Date(),
  confidence: "high" as const,
};

describe("handleReentryForTerminalConversation", () => {
  let deps: ReentryDeps;
  let mockConversationsService: any;
  let mockChatConversationsService: any;
  let mockPatientHistoryService: any;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    mockConversationsService = {
      findLeadById: jest.fn().mockResolvedValue(mockLead),
      updateReturningPatientFlags: jest.fn().mockResolvedValue(undefined),
      setContext: jest.fn().mockResolvedValue(undefined),
    };

    mockChatConversationsService = {
      resetConversation: jest.fn().mockResolvedValue(undefined),
      startConversation: jest.fn().mockResolvedValue("Welcome back, Sarah!"),
    };

    mockPatientHistoryService = {
      findReturningPatient: jest.fn().mockResolvedValue(mockReturningPatient),
    };

    deps = {
      conversationsService: mockConversationsService,
      chatConversationsService: mockChatConversationsService,
      patientHistoryService: mockPatientHistoryService,
      logger: new Logger("ReentryTest"),
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it("should set returning patient flags and return greeting when history match found", async () => {
    const conversation = buildMockConversation("booked");
    const result = await handleReentryForTerminalConversation(
      conversation, clinicConfig, deps, "test-corr",
    );

    expect(mockConversationsService.updateReturningPatientFlags).toHaveBeenCalledWith(
      mockConversationId,
      {
        isReturningPatient: true,
        previousConversationId: mockPreviousConvId,
        returningPatientConfidence: "high",
      },
    );
    expect(mockConversationsService.setContext).toHaveBeenCalledWith(
      mockConversationId, "returningPatientPostcode", "CF10 1AA",
    );
    expect(mockChatConversationsService.resetConversation).toHaveBeenCalledWith(
      mockConversationId.toHexString(),
    );
    expect(mockChatConversationsService.startConversation).toHaveBeenCalledWith(
      mockConversationId.toHexString(),
    );
    expect(result).toBe("Welcome back, Sarah!");
  });

  it("should reset as new patient when no history match found", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);
    const conversation = buildMockConversation("cancelled");

    const result = await handleReentryForTerminalConversation(
      conversation, clinicConfig, deps,
    );

    expect(mockConversationsService.updateReturningPatientFlags).not.toHaveBeenCalled();
    expect(mockConversationsService.setContext).not.toHaveBeenCalled();
    expect(mockChatConversationsService.resetConversation).toHaveBeenCalled();
    expect(mockChatConversationsService.startConversation).toHaveBeenCalled();
    expect(result).toBe("Welcome back, Sarah!");
  });

  it("should fall back to new patient flow when findReturningPatient returns null (DB error handled internally)", async () => {
    // findReturningPatient returns null on internal DB errors (null-on-failure pattern)
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);
    const conversation = buildMockConversation("booked");

    const result = await handleReentryForTerminalConversation(
      conversation, clinicConfig, deps,
    );

    expect(mockConversationsService.updateReturningPatientFlags).not.toHaveBeenCalled();
    expect(mockChatConversationsService.resetConversation).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("should fall back to new patient flow when lead is not found", async () => {
    mockConversationsService.findLeadById.mockResolvedValue(null);
    const conversation = buildMockConversation("declined");

    const result = await handleReentryForTerminalConversation(
      conversation, clinicConfig, deps,
    );

    expect(mockPatientHistoryService.findReturningPatient).not.toHaveBeenCalled();
    expect(mockConversationsService.updateReturningPatientFlags).not.toHaveBeenCalled();
    expect(mockChatConversationsService.resetConversation).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("should not store postcode when validatedPostcode is absent from match", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue({
      ...mockReturningPatient,
      validatedPostcode: undefined,
    });
    const conversation = buildMockConversation("booked");

    await handleReentryForTerminalConversation(conversation, clinicConfig, deps);

    expect(mockConversationsService.updateReturningPatientFlags).toHaveBeenCalled();
    expect(mockConversationsService.setContext).not.toHaveBeenCalled();
  });

  it("should pass stale confidence through correctly", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue({
      ...mockReturningPatient,
      confidence: "stale",
    });
    const conversation = buildMockConversation("booked");

    await handleReentryForTerminalConversation(conversation, clinicConfig, deps);

    expect(mockConversationsService.updateReturningPatientFlags).toHaveBeenCalledWith(
      mockConversationId,
      expect.objectContaining({ returningPatientConfidence: "stale" }),
    );
  });

  it("should return FALLBACK_AI_UNAVAILABLE when startConversation returns null", async () => {
    mockChatConversationsService.startConversation.mockResolvedValue(null);
    const conversation = buildMockConversation("booked");

    const result = await handleReentryForTerminalConversation(
      conversation, clinicConfig, deps,
    );

    expect(result).toBe(FALLBACK_AI_UNAVAILABLE);
  });

  it("should produce the same state when called twice (idempotency)", async () => {
    const conversation = buildMockConversation("booked");

    await handleReentryForTerminalConversation(conversation, clinicConfig, deps);
    await handleReentryForTerminalConversation(conversation, clinicConfig, deps);

    // Both calls should invoke the same sequence — no drift
    expect(mockChatConversationsService.resetConversation).toHaveBeenCalledTimes(2);
    expect(mockChatConversationsService.startConversation).toHaveBeenCalledTimes(2);
    expect(mockConversationsService.updateReturningPatientFlags).toHaveBeenCalledTimes(2);
  });

  it("should use configured patientDataExpiryDays from clinicConfig", async () => {
    const customConfig = { ...clinicConfig, patientDataExpiryDays: 180 };
    const conversation = buildMockConversation("booked");

    await handleReentryForTerminalConversation(conversation, customConfig, deps);

    expect(mockPatientHistoryService.findReturningPatient).toHaveBeenCalledWith(
      mockLead.phone, mockLead.email, customConfig.clinicId, 180,
    );
  });
});
