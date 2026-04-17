import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NotFoundException } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { ConversationsPersistenceService } from "./conversations.persistence.service";
import { ChatService } from "../ai/chat.service";
import { SlotProvider } from "../ai/slot-provider";
import { AppointmentsService } from "../appointments/appointments.service";
import { UrgencyPipeline } from "../ai/urgency-pipeline";
import { EscalationService } from "../ai/escalation.service";
import { ComprehensionClassifier } from "../ai/comprehension-classifier";
import { AbuseHandlerService } from "./abuse-handler.service";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { CancellationService } from "../cancellation/cancellation.service";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { PostcodeValidationService } from "../orchestrator/postcode-validation.service";
import { GhlApiService } from '../ghl/ghl-api.service';
import { ConsentService } from "../gdpr/consent/consent.service";

describe("ConversationsService", () => {
  let service: ConversationsService;

  // Mock Mongoose models
  const mockConversationModel = {
    findById: jest.fn(),
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    findByIdAndUpdate: jest.fn(),
  };

  const mockMessageModel = {
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
    create: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  };

  const mockClinicModel = { findById: jest.fn() };
  const mockLeadModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  };

  const mockChatService = {
    startConversation: jest.fn(),
    sendMessage: jest.fn(),
  };

  const mockSlotProvider = {
    getAvailableSlots: jest
      .fn()
      .mockResolvedValue([
        { date: "2026-03-17", startTime: "14:00", endTime: "14:30" },
      ]),
  };

  const mockAbuseHandler = {
    handle: jest.fn().mockResolvedValue(null),
  };

  const mockSecurityPipeline = {
    processInbound: jest.fn().mockImplementation((msg: string) =>
      Promise.resolve({
        allowed: true,
        sanitisedMessage: msg,
        threatScore: 0,
        flags: [],
      }),
    ),
    validateOutput: jest.fn().mockReturnValue({ safe: true, flags: [] }),
  };

  const mockAppointmentsService = {
    bookAppointment: jest.fn(),
  };

  const mockUrgencyPipeline = {
    assessMessage: jest.fn().mockResolvedValue({
      resolved: "routine",
      assessment: {
        level: "routine",
        score: 0.1,
        signals: [],
        isAmbiguous: false,
        requiresEscalation: false,
        emergencyKeywordsMatched: [],
      },
    }),
    assessFormData: jest.fn().mockReturnValue({
      resolved: "routine",
      assessment: {
        level: "routine",
        score: 0.1,
        signals: [],
        isAmbiguous: false,
        requiresEscalation: false,
        emergencyKeywordsMatched: [],
      },
    }),
  };

  const mockEscalationService = {
    escalate: jest.fn().mockResolvedValue({
      aiMessage: "Escalated.",
      escalationReason: "test",
      notificationId: "notif_1",
    }),
    escalateEmergency: jest.fn(),
    handleNoSlotsForUrgent: jest.fn(),
    notifyClinicStaff: jest.fn(),
    updateGhlTags: jest.fn().mockResolvedValue(undefined),
  };

  const mockComprehensionClassifier = {
    classify: jest.fn().mockResolvedValue("understood"),
  };

  const mockCancellationService = {
    checkAppointmentExists: jest.fn().mockResolvedValue(null),
    buildConfirmationPrompt: jest.fn(),
    evaluatePolicy: jest.fn(),
    executeCancellation: jest.fn(),
    isAwaitingReason: jest.fn().mockResolvedValue(false),
    requestReason: jest.fn(),
    storeReason: jest.fn(),
  };

  const mockPersistenceService = {
    saveMessage: jest.fn().mockResolvedValue({}),
    updateConversationMeta: jest.fn().mockResolvedValue({}),
    storeOfferedSlots: jest.fn().mockResolvedValue({}),
    saveDateContext: jest.fn().mockResolvedValue({}),
  };

  // Shared test fixtures
  const mockConversation = {
    _id: "conv1",
    clinicId: "clinic1",
    leadId: "lead1",
    channel: "website",
    phase: "greeting",
    isReturningPatient: false,
  };

  const mockClinic = {
    _id: "clinic1",
    name: "Cardiff Physiotherapy Centre",
    ghlLocationId: "loc1",
    isActive: true,
    aiConfig: {
      tone: "friendly",
      greetingTemplate: "",
      customInstructions: "",
    },
    serviceAreas: [{ postcodePrefix: "CF" }],
  };

  const mockLead = {
    _id: "lead1",
    firstName: "Sarah",
    lastName: "Williams",
    phone: "07700 900123",
    email: "sarah@email.com",
    issue: "Back Pain",
    leadSource: "facebook",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: getModelToken("Conversation"),
          useValue: mockConversationModel,
        },
        { provide: getModelToken("Message"), useValue: mockMessageModel },
        { provide: getModelToken("Clinic"), useValue: mockClinicModel },
        { provide: getModelToken("Lead"), useValue: mockLeadModel },
        { provide: ChatService, useValue: mockChatService },
        { provide: SlotProvider, useValue: mockSlotProvider },
        { provide: AbuseHandlerService, useValue: mockAbuseHandler },
        { provide: AppointmentsService, useValue: mockAppointmentsService },
        { provide: UrgencyPipeline, useValue: mockUrgencyPipeline },
        { provide: EscalationService, useValue: mockEscalationService },
        { provide: ComprehensionClassifier, useValue: mockComprehensionClassifier },
        { provide: SecurityPipelineService, useValue: mockSecurityPipeline },
        { provide: GhlApiService, useValue: { cancelAppointment: jest.fn().mockResolvedValue({}) } },
        { provide: CancellationService, useValue: mockCancellationService },
        {
          provide: ConversationsPersistenceService,
          useValue: mockPersistenceService,
        },
        {
          provide: PatientHistoryService,
          useValue: {
            findReturningPatient: jest.fn().mockResolvedValue(null),
            persistHistory: jest.fn(),
          },
        },
        PostcodeValidationService,
        { provide: ConsentService, useValue: { recordConsent: jest.fn(), hasActiveConsent: jest.fn().mockResolvedValue(false), getConsentHistory: jest.fn(), withdrawConsent: jest.fn() } },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    jest.clearAllMocks();
  });

  describe("getConversation", () => {
    it("should return conversation with messages, clinic, and lead", async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);

      const result = await service.getConversation("conv1");

      expect(result.conversation).toEqual(mockConversation);
      expect(result.clinic).toEqual(mockClinic);
      expect(result.lead).toEqual(mockLead);
    });

    it("should throw NotFoundException for invalid ID", async () => {
      mockConversationModel.findById.mockResolvedValue(null);
      await expect(service.getConversation("bad_id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("startConversation", () => {
    it("should generate greeting and save as message", async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.startConversation.mockResolvedValue("Hi Sarah!");
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.startConversation("conv1");

      expect(result).toBe("Hi Sarah!");
      expect(mockPersistenceService.saveMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        "ai",
        "Hi Sarah!",
      );
    });

    it("should return fallback when greeting fails", async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.startConversation.mockResolvedValue(null);

      const result = await service.startConversation("conv1");
      expect(result).toBe(
        "Thanks for your message! Someone from the clinic will be in touch shortly.",
      );
    });
  });

  describe("resetConversation", () => {
    it("should delete messages and reset conversation phase and lead urgency", async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      await service.resetConversation("conv1");

      expect(mockMessageModel.deleteMany).toHaveBeenCalledWith({
        conversationId: "conv1",
      });
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        expect.objectContaining({
          $set: expect.objectContaining({ phase: "greeting", messageCount: 0 }),
        }),
      );
      expect(mockLeadModel.findByIdAndUpdate).toHaveBeenCalledWith("lead1", {
        urgency: "unknown",
      });
    });

    it("should throw NotFoundException for invalid ID", async () => {
      mockConversationModel.findById.mockResolvedValue(null);
      await expect(service.resetConversation("bad_id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("sendMessage", () => {
    it("should save user message and AI reply with offered slots", async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({
        sort: jest
          .fn()
          .mockResolvedValue([{ sender: "ai", content: "Hi Sarah!" }]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.sendMessage.mockResolvedValue("Let me check that.");
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.sendMessage("conv1", "My postcode is CF10");

      expect(result).not.toBeNull();
      expect(result!.reply).toBe("Let me check that.");
      expect(result!.offeredSlots).toBeDefined();
      // Should save one lead message (with urgency data) + one AI reply
      expect(mockPersistenceService.saveMessage).toHaveBeenCalledTimes(2);
    });

    it("should return follow-up message when conversation is already escalated", async () => {
      const escalatedConversation = { ...mockConversation, phase: "escalated" };
      mockConversationModel.findById.mockResolvedValue(escalatedConversation);
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockUrgencyPipeline.assessMessage.mockResolvedValueOnce({
        resolved: "emergency",
        assessment: {
          level: "emergency",
          score: 1.0,
          signals: [],
          isAmbiguous: false,
          requiresEscalation: true,
          emergencyKeywordsMatched: [],
        },
      });
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.sendMessage(
        "conv1",
        "actually its fine now",
      );

      expect(result!.reply).toContain("already been flagged");
      expect(result!.reply).toContain("999");
      // Should NOT call escalateEmergency again
      expect(mockEscalationService.escalateEmergency).not.toHaveBeenCalled();
    });

    it("should return fallback message when AI fails", async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.sendMessage.mockResolvedValue(null);

      const result = await service.sendMessage("conv1", "Hello");

      // Service returns null when AI fails; controller wraps with fallback
      expect(result).toBeNull();
      expect(mockPersistenceService.saveMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancellation intercept", () => {
    const bookedConversation = { ...mockConversation, phase: "booked" };
    const cancellingConversation = { ...mockConversation, phase: "cancelling" };
    const mockAppointment = {
      _id: "apt_1",
      appointmentDate: new Date(),
      status: "confirmed",
    };

    beforeEach(() => {
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    });

    it('should intercept "cancel" keyword in booked phase and return confirmation', async () => {
      mockConversationModel.findById.mockResolvedValue(bookedConversation);
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.buildConfirmationPrompt.mockReturnValue(
        "Just to confirm, you'd like to cancel your appointment on Friday 3rd April at 10:20 AM. Is that correct?",
      );

      const result = await service.sendMessage(
        "conv1",
        "I want to cancel my appointment",
      );

      expect(result!.reply).toContain("cancel your appointment");
      expect(mockCancellationService.checkAppointmentExists).toHaveBeenCalled();
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it("should intercept confirm keyword in cancelling phase and ask for reason", async () => {
      mockConversationModel.findById.mockResolvedValue(cancellingConversation);
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.evaluatePolicy.mockResolvedValue({
        withinNotice: false,
        feeEnabled: false,
      });
      mockCancellationService.isAwaitingReason.mockResolvedValue(false);
      mockCancellationService.requestReason.mockResolvedValue(
        "May I ask the reason for cancelling?",
      );

      const result = await service.sendMessage("conv1", "yes");

      expect(result!.reply).toContain("reason for cancelling");
      expect(
        mockCancellationService.executeCancellation,
      ).not.toHaveBeenCalled();
    });

    it("should execute cancellation when reason is provided as freeform text", async () => {
      mockConversationModel.findById.mockResolvedValue(cancellingConversation);
      mockCancellationService.isAwaitingReason.mockResolvedValue(true);
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.executeCancellation.mockResolvedValue({
        success: true,
        message:
          "Your appointment has been cancelled. Feel free to book again anytime!",
      });

      const result = await service.sendMessage(
        "conv1",
        "Moving away from the area",
      );

      expect(result!.reply).toContain("cancelled");
      expect(mockCancellationService.storeReason).toHaveBeenCalledWith(
        expect.anything(),
        "Moving away from the area",
      );
    });

    it("should intercept decline keyword and reassure appointment is kept", async () => {
      mockConversationModel.findById.mockResolvedValue(cancellingConversation);

      const result = await service.sendMessage("conv1", "no, keep it");

      expect(result!.reply).toContain("still confirmed");
      expect(
        mockCancellationService.executeCancellation,
      ).not.toHaveBeenCalled();
    });

    it("should not intercept cancellation keywords in non-cancellation phases", async () => {
      mockConversationModel.findById.mockResolvedValue({
        ...mockConversation,
        phase: "qualifying",
      });
      mockChatService.sendMessage.mockResolvedValue("How can I help?");

      await service.sendMessage("conv1", "I want to cancel my appointment");

      expect(
        mockCancellationService.checkAppointmentExists,
      ).not.toHaveBeenCalled();
      expect(mockChatService.sendMessage).toHaveBeenCalled();
    });
  });

  describe("returning patient intercept (sendMessage)", () => {
    const returningConversation = {
      ...mockConversation,
      phase: "greeting",
      isReturningPatient: true,
      context: new Map([["returningPatientPostcode", "CF10 1AA"]]),
    };

    beforeEach(() => {
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    });

    it('DETAILS_UNCHANGED: exact keyword "yes" copies stored postcode to validatedPostcode and advances phase to booking', async () => {
      mockConversationModel.findById.mockResolvedValue(returningConversation);
      mockChatService.sendMessage.mockResolvedValue(
        "Great, let me check availability.",
      );

      await service.sendMessage("conv1", "yes");

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        { $set: { "context.validatedPostcode": "CF10 1AA" } },
      );
      expect(
        mockPersistenceService.updateConversationMeta,
      ).toHaveBeenCalledWith(expect.anything(), "ai", "booking");
    });

    it('DETAILS_UNCHANGED: keyword "yes" embedded mid-sentence does NOT trigger intercept', async () => {
      mockConversationModel.findById.mockResolvedValue(returningConversation);
      mockChatService.sendMessage.mockResolvedValue(
        "Thanks for letting me know.",
      );

      await service.sendMessage("conv1", "yes I have back pain");

      const postcodeCalls =
        mockConversationModel.findByIdAndUpdate.mock.calls.filter(
          ([, update]) =>
            update?.$set?.["context.validatedPostcode"] === "CF10 1AA",
        );
      expect(postcodeCalls).toHaveLength(0);

      const bookingCalls =
        mockPersistenceService.updateConversationMeta.mock.calls.filter(
          ([, , phase]) => phase === "booking",
        );
      expect(bookingCalls).toHaveLength(0);
    });

    it('DETAILS_CHANGED: exact keyword "moved" updates phase to qualifying and returns early without calling AI', async () => {
      mockConversationModel.findById.mockResolvedValue(returningConversation);

      const result = await service.sendMessage("conv1", "moved");

      expect(result).not.toBeNull();
      expect(result!.reply).toBeTruthy();
      expect(
        mockPersistenceService.updateConversationMeta,
      ).toHaveBeenCalledWith(expect.anything(), "ai", "qualifying");
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('DETAILS_CHANGED: exact keyword "no" updates phase to qualifying and returns early without calling AI', async () => {
      mockConversationModel.findById.mockResolvedValue(returningConversation);

      const result = await service.sendMessage("conv1", "no");

      expect(result).not.toBeNull();
      expect(
        mockPersistenceService.updateConversationMeta,
      ).toHaveBeenCalledWith(expect.anything(), "ai", "qualifying");
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it("non-matching message falls through to normal AI flow", async () => {
      mockConversationModel.findById.mockResolvedValue(returningConversation);
      mockChatService.sendMessage.mockResolvedValue(
        "How can I help you today?",
      );

      const result = await service.sendMessage(
        "conv1",
        "I have a question about costs",
      );

      expect(result!.reply).toBe("How can I help you today?");
      expect(mockChatService.sendMessage).toHaveBeenCalled();
    });

    it('DETAILS_UNCHANGED: multi-word phrase "nothing changed" mid-sentence still triggers', async () => {
      mockConversationModel.findById.mockResolvedValue(returningConversation);
      mockChatService.sendMessage.mockResolvedValue("Understood.");

      await service.sendMessage("conv1", "actually nothing changed for me");

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        { $set: { "context.validatedPostcode": "CF10 1AA" } },
      );
      expect(
        mockPersistenceService.updateConversationMeta,
      ).toHaveBeenCalledWith(expect.anything(), "ai", "booking");
    });

    it("DETAILS_UNCHANGED: no stored postcode — skips context write but still advances phase to booking", async () => {
      const noPostcodeConv = {
        ...returningConversation,
        context: new Map<string, string>(),
      };
      mockConversationModel.findById.mockResolvedValue(noPostcodeConv);
      mockChatService.sendMessage.mockResolvedValue(
        "Let me check availability.",
      );

      await service.sendMessage("conv1", "yes");

      const postcodeCalls =
        mockConversationModel.findByIdAndUpdate.mock.calls.filter(
          ([, update]) => update?.$set?.["context.validatedPostcode"],
        );
      expect(postcodeCalls).toHaveLength(0);
      expect(
        mockPersistenceService.updateConversationMeta,
      ).toHaveBeenCalledWith(expect.anything(), "ai", "booking");
    });
  });

  describe("US-20: comprehension outcome and escalation wiring", () => {
    beforeEach(() => {
      mockConversationModel.findById.mockResolvedValue({
        ...mockConversation,
        failedUnderstandingCount: 0,
      });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.sendMessage.mockResolvedValue("Here are some slots.");
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    });

    it("resets failedUnderstandingCount when AI understood", async () => {
      mockConversationModel.findById.mockResolvedValue({
        ...mockConversation,
        failedUnderstandingCount: 2,
      });
      mockComprehensionClassifier.classify.mockResolvedValue("understood");

      await service.sendMessage("conv1", "I need a filling");

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        { failedUnderstandingCount: 0 },
      );
    });

    it("skips counter reset when count is already 0", async () => {
      mockComprehensionClassifier.classify.mockResolvedValue("understood");

      await service.sendMessage("conv1", "I need a filling");

      const resetCalls = mockConversationModel.findByIdAndUpdate.mock.calls.filter(
        ([, update]) => update?.failedUnderstandingCount === 0,
      );
      expect(resetCalls).toHaveLength(0);
    });

    it("increments failedUnderstandingCount on unclear", async () => {
      mockComprehensionClassifier.classify.mockResolvedValue("unclear");
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({
        failedUnderstandingCount: 1,
      });

      await service.sendMessage("conv1", "asdf");

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        { $inc: { failedUnderstandingCount: 1 } },
        { new: true },
      );
    });

    it("escalates at failedUnderstandingCount >= 3", async () => {
      mockComprehensionClassifier.classify.mockResolvedValue("unclear");
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({
        failedUnderstandingCount: 3,
      });

      const result = await service.sendMessage("conv1", "asdf");

      expect(mockEscalationService.escalate).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: "failed_understanding",
          reason: "3 consecutive AI comprehension failures",
        }),
      );
      expect(result!.reply).toBe("Escalated.");
    });

    it("does not escalate when count is below 3", async () => {
      mockComprehensionClassifier.classify.mockResolvedValue("unclear");
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({
        failedUnderstandingCount: 2,
      });

      await service.sendMessage("conv1", "asdf");

      expect(mockEscalationService.escalate).not.toHaveBeenCalled();
    });

    it("skips comprehension check on FALLBACK_AI_UNAVAILABLE reply", async () => {
      mockChatService.sendMessage.mockResolvedValue(null);

      await service.sendMessage("conv1", "hello");

      expect(mockComprehensionClassifier.classify).not.toHaveBeenCalled();
    });

    it("routes abuse escalation through escalate() funnel", async () => {
      mockAbuseHandler.handle.mockResolvedValue({
        reply: "Connecting you with a team member.",
        offeredSlots: [],
        slotSelection: null,
        bookingResult: null,
        abuseFlagged: true,
        escalationRequested: true,
      });

      await service.sendMessage("conv1", "you're useless, get me a human");

      expect(mockEscalationService.escalate).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: "abuse",
          reason: expect.stringContaining("Abuse hand-off"),
        }),
      );
    });

    it("does not call escalate when abuse handler returns escalationRequested: false", async () => {
      mockAbuseHandler.handle.mockResolvedValue({
        reply: "I understand you're frustrated.",
        offeredSlots: [],
        slotSelection: null,
        bookingResult: null,
        abuseFlagged: true,
        escalationRequested: false,
      });

      await service.sendMessage("conv1", "this is stupid");

      expect(mockEscalationService.escalate).not.toHaveBeenCalled();
    });
  });
});
