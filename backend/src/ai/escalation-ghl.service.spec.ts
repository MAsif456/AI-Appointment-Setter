import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { EscalationGhlService } from "./escalation-ghl.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { EncryptionService } from "../common/encryption/encryption.service";

// Stub retryWithBackoff so tests don't wait on exponential delays.
jest.mock("../common/retry-utils", () => ({
  retryWithBackoff: jest.fn((fn: () => Promise<any>) => fn()),
}));

describe("EscalationGhlService", () => {
  let service: EscalationGhlService;
  let mockGhlApi: {
    addContactTag: jest.Mock;
    updateContactCustomField: jest.Mock;
    sendMessageWithRetry: jest.Mock;
  };
  let mockLeadModel: { findByIdAndUpdate: jest.Mock };

  const baseLead: any = {
    _id: "lead_1",
    firstName: "Jane",
    lastName: "Doe",
    phone: "+447700900123",
    ghlContactId: "ghl_c1",
    ghlTags: [],
  };
  const baseConversation: any = { _id: "conv_1", ghlContactId: "ghl_c1" };
  const baseClinic: any = { _id: "clinic_1", name: "Smile Dental Bristol" };
  const reason = "3 consecutive AI comprehension failures";

  beforeEach(async () => {
    mockGhlApi = {
      addContactTag: jest.fn().mockResolvedValue({}),
      updateContactCustomField: jest.fn().mockResolvedValue({}),
      sendMessageWithRetry: jest.fn().mockResolvedValue({}),
    };
    mockLeadModel = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationGhlService,
        { provide: GhlApiService, useValue: mockGhlApi },
        { provide: EncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn().mockReturnValue('') } },
        { provide: getModelToken("Lead"), useValue: mockLeadModel },
      ],
    }).compile();

    service = module.get(EscalationGhlService);
  });

  afterEach(() => jest.clearAllMocks());

  it("adds the escalated tag to the lead doc and GHL contact", async () => {
    await service.applyEscalationToGhl(
      baseLead,
      baseConversation,
      baseClinic,
      reason,
    );

    expect(mockLeadModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "lead_1",
      { $addToSet: { ghlTags: "escalated" } },
    );
    expect(mockGhlApi.addContactTag).toHaveBeenCalledWith(
      expect.any(String),
      "ghl_c1",
      "escalated",
    );
  });

  it("skips local tag update when lead already has the tag", async () => {
    const tagged = { ...baseLead, ghlTags: ["escalated"] };
    await service.applyEscalationToGhl(
      tagged,
      baseConversation,
      baseClinic,
      reason,
    );

    expect(mockLeadModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(mockGhlApi.addContactTag).toHaveBeenCalled();
  });

  it("sets the escalation_reason custom field on GHL", async () => {
    await service.applyEscalationToGhl(
      baseLead,
      baseConversation,
      baseClinic,
      reason,
    );

    expect(mockGhlApi.updateContactCustomField).toHaveBeenCalledWith(
      expect.any(String),
      "ghl_c1",
      "escalation_reason",
      reason,
    );
  });

  it("sends SMS alert to clinic staff", async () => {
    await service.applyEscalationToGhl(
      baseLead,
      baseConversation,
      baseClinic,
      reason,
    );

    expect(mockGhlApi.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        type: "SMS",
        contactId: "ghl_c1",
      }),
    );
  });

  it("falls back to conversation ghlContactId when lead has none", async () => {
    const noGhl = { ...baseLead, ghlContactId: undefined };
    await service.applyEscalationToGhl(
      noGhl,
      baseConversation,
      baseClinic,
      reason,
    );

    expect(mockGhlApi.addContactTag).toHaveBeenCalledWith(
      expect.any(String),
      "ghl_c1",
      "escalated",
    );
  });

  it("falls back to lead._id when both ghlContactId fields are empty", async () => {
    const noGhl = { ...baseLead, ghlContactId: undefined };
    const noConvGhl = { ...baseConversation, ghlContactId: undefined };
    await service.applyEscalationToGhl(noGhl, noConvGhl, baseClinic, reason);

    expect(mockGhlApi.addContactTag).toHaveBeenCalledWith(
      expect.any(String),
      "lead_1",
      "escalated",
    );
  });

  it("logs and swallows GHL tag failure without throwing", async () => {
    mockGhlApi.addContactTag.mockRejectedValue(new Error("GHL down"));

    await expect(
      service.applyEscalationToGhl(
        baseLead,
        baseConversation,
        baseClinic,
        reason,
      ),
    ).resolves.toBeUndefined();
  });

  it("logs and swallows custom field failure without throwing", async () => {
    mockGhlApi.updateContactCustomField.mockRejectedValue(
      new Error("GHL 500"),
    );

    await expect(
      service.applyEscalationToGhl(
        baseLead,
        baseConversation,
        baseClinic,
        reason,
      ),
    ).resolves.toBeUndefined();
  });

  it("logs and swallows SMS failure without throwing", async () => {
    mockGhlApi.sendMessageWithRetry.mockRejectedValue(
      new Error("GHL SMS fail"),
    );

    await expect(
      service.applyEscalationToGhl(
        baseLead,
        baseConversation,
        baseClinic,
        reason,
      ),
    ).resolves.toBeUndefined();
  });

  it("runs all three GHL calls independently", async () => {
    mockGhlApi.addContactTag.mockRejectedValue(new Error("fail 1"));
    mockGhlApi.updateContactCustomField.mockRejectedValue(
      new Error("fail 2"),
    );

    await service.applyEscalationToGhl(
      baseLead,
      baseConversation,
      baseClinic,
      reason,
    );

    // SMS still fires despite other two failing
    expect(mockGhlApi.sendMessageWithRetry).toHaveBeenCalled();
  });
});
