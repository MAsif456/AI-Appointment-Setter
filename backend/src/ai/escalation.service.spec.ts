import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import {
  EscalationService,
  PATIENT_FAILED_UNDERSTANDING_RESPONSE,
} from "./escalation.service";
import { EscalationGhlService } from "./escalation-ghl.service";
import { EscalationNotifierService } from "./escalation-notifier.service";
import { PATIENT_EMERGENCY_RESPONSE } from "./urgency-messages";
import { UrgencyAssessment } from "./urgency-detector.types";

describe("EscalationService", () => {
  let service: EscalationService;
  let mockConversationModel: { findOneAndUpdate: jest.Mock; findByIdAndUpdate: jest.Mock };
  let mockLeadModel: { findByIdAndUpdate: jest.Mock };
  let mockGhl: { applyEscalationToGhl: jest.Mock };
  let mockNotifier: { recordAndPublish: jest.Mock };

  const mockConversation: any = { _id: "conv_1", ghlContactId: "ghl_c1" };
  const mockLead: any = {
    _id: "lead_1",
    firstName: "Sarah",
    lastName: "Jones",
    phone: "+447700900123",
    ghlContactId: "ghl_c1",
    ghlTags: [],
  };
  const mockClinic: any = { _id: "clinic_1", name: "Cardiff Physio" };

  beforeEach(async () => {
    mockConversationModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue({ ...mockConversation, phase: "escalated" }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };
    mockLeadModel = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) };
    mockGhl = { applyEscalationToGhl: jest.fn().mockResolvedValue(undefined) };
    mockNotifier = { recordAndPublish: jest.fn().mockResolvedValue("notif_1") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: getModelToken("Conversation"), useValue: mockConversationModel },
        { provide: getModelToken("Lead"), useValue: mockLeadModel },
        { provide: EscalationGhlService, useValue: mockGhl },
        { provide: EscalationNotifierService, useValue: mockNotifier },
      ],
    }).compile();

    service = module.get(EscalationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("escalate() — single funnel", () => {
    it("sets phase to escalated and flags requiresHumanIntervention", async () => {
      await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "failed_understanding",
        reason: "3 consecutive AI comprehension failures",
      });

      expect(mockConversationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "conv_1", requiresHumanIntervention: { $ne: true } },
        expect.objectContaining({
          $set: expect.objectContaining({
            requiresHumanIntervention: true,
            phase: "escalated",
          }),
        }),
        { returnDocument: 'after' },
      );
    });

    it("returns the default failed-understanding message", async () => {
      const result = await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "failed_understanding",
        reason: "3 consecutive AI comprehension failures",
      });

      expect(result.aiMessage).toBe(PATIENT_FAILED_UNDERSTANDING_RESPONSE);
      expect(result.notificationId).toBe("notif_1");
    });

    it("uses patientMessage when provided", async () => {
      const result = await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "abuse",
        reason: "Abuse hand-off",
        patientMessage: "A team member will call you shortly.",
      });

      expect(result.aiMessage).toBe("A team member will call you shortly.");
    });

    it("falls back to default abuse message when no patientMessage given", async () => {
      const result = await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "abuse",
        reason: "Abuse hand-off",
      });

      expect(result.aiMessage).toBe("A team member will be in touch shortly.");
    });

    it("sets isEmergency flag for emergency triggers", async () => {
      await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "emergency",
        reason: "Emergency keywords",
      });

      expect(mockConversationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({ isEmergency: true }),
        }),
        expect.anything(),
      );
    });

    it("does not set isEmergency for non-emergency triggers", async () => {
      await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "failed_understanding",
        reason: "comprehension failure",
      });

      const setArg = mockConversationModel.findOneAndUpdate.mock.calls[0][1].$set;
      expect(setArg.isEmergency).toBeUndefined();
    });

    it("fires GHL and notifier after successful conversation update", async () => {
      await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "failed_understanding",
        reason: "test",
      });

      expect(mockGhl.applyEscalationToGhl).toHaveBeenCalled();
      expect(mockNotifier.recordAndPublish).toHaveBeenCalled();
    });
  });

  describe("idempotency guard", () => {
    it("skips GHL and notifier when already escalated", async () => {
      mockConversationModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "failed_understanding",
        reason: "test",
      });

      expect(mockGhl.applyEscalationToGhl).not.toHaveBeenCalled();
      expect(mockNotifier.recordAndPublish).not.toHaveBeenCalled();
      expect(result.notificationId).toBeNull();
    });

    it("still returns a valid aiMessage when idempotency guard fires", async () => {
      mockConversationModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "failed_understanding",
        reason: "test",
      });

      expect(result.aiMessage).toBe(PATIENT_FAILED_UNDERSTANDING_RESPONSE);
    });
  });

  describe("GHL failure isolation", () => {
    it("still returns notificationId when GHL throws", async () => {
      mockGhl.applyEscalationToGhl.mockRejectedValue(new Error("GHL down"));

      const result = await service.escalate({
        conversation: mockConversation,
        lead: mockLead,
        clinic: mockClinic,
        trigger: "failed_understanding",
        reason: "test",
      });

      // GHL runs in the background (fire-and-forget) — notifier still fires.
      expect(result.notificationId).toBe("notif_1");
    });
  });

  describe("escalateEmergency() — back-compat adapter", () => {
    const assessment: UrgencyAssessment = {
      level: "emergency",
      score: 1.0,
      signals: [
        { source: "keyword", text: "chest pain", score: 1.0, classification: "emergency" },
      ],
      isAmbiguous: false,
      requiresEscalation: true,
      emergencyKeywordsMatched: ["chest pain"],
    };

    it("delegates to escalate() with trigger=emergency", async () => {
      const result = await service.escalateEmergency(
        mockConversation,
        mockLead,
        mockClinic,
        assessment,
      );

      expect(result.aiMessage).toContain("999");
      expect(mockConversationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: "conv_1" }),
        expect.objectContaining({
          $set: expect.objectContaining({ isEmergency: true }),
        }),
        expect.anything(),
      );
    });

    it("includes matched keywords in the reason", async () => {
      await service.escalateEmergency(
        mockConversation,
        mockLead,
        mockClinic,
        assessment,
      );

      expect(mockConversationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            humanInterventionReason: expect.stringContaining("chest pain"),
          }),
        }),
        expect.anything(),
      );
    });

    it("uses generic reason when no emergency keywords matched", async () => {
      const noKeywords: UrgencyAssessment = {
        ...assessment,
        emergencyKeywordsMatched: [],
      };
      await service.escalateEmergency(
        mockConversation,
        mockLead,
        mockClinic,
        noKeywords,
      );

      expect(mockConversationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            humanInterventionReason: "Emergency classified by urgency detector",
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe("handleNoSlotsForUrgent() — back-compat adapter", () => {
    it("flags requiresHumanIntervention without setting phase to escalated", async () => {
      const msg = await service.handleNoSlotsForUrgent(
        mockConversation,
        mockClinic,
        mockLead,
      );

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv_1",
        expect.objectContaining({ requiresHumanIntervention: true }),
      );
      expect(msg).toContain("flagged your case as urgent");
    });

    it("fires GHL and notifier", async () => {
      await service.handleNoSlotsForUrgent(
        mockConversation,
        mockClinic,
        mockLead,
      );

      expect(mockGhl.applyEscalationToGhl).toHaveBeenCalled();
      expect(mockNotifier.recordAndPublish).toHaveBeenCalled();
    });

    it("swallows GHL errors and still returns patient message", async () => {
      mockGhl.applyEscalationToGhl.mockRejectedValue(new Error("GHL down"));

      const msg = await service.handleNoSlotsForUrgent(
        mockConversation,
        mockClinic,
        mockLead,
      );
      expect(msg).toContain("flagged your case as urgent");
    });
  });

  describe("updateGhlTags()", () => {
    it("adds urgency tag to lead", async () => {
      await service.updateGhlTags(mockLead, "urgent");
      expect(mockLeadModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "lead_1",
        { $addToSet: { ghlTags: "urgent" } },
      );
    });

    it("does not duplicate existing tag", async () => {
      const tagged = { ...mockLead, ghlTags: ["urgent"] };
      await service.updateGhlTags(tagged, "urgent");
      expect(mockLeadModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
