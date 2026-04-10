/**
 * Integration tests for the slot-selection detection behaviour wired into
 * ConversationsService.sendMessage().
 *
 * These tests verify that, when a lead replies after slots have been offered,
 * the service correctly detects their intent and returns a slotSelection result.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConversationsService } from "./conversations.service";
import { ConversationsPersistenceService } from "./conversations.persistence.service";
import { ChatService } from "../ai/chat.service";
import { SlotProvider } from "../ai/slot-provider";
import { AppointmentsService } from "../appointments/appointments.service";
import { UrgencyPipeline } from "../ai/urgency-pipeline";
import { EscalationService } from "../ai/escalation.service";
import { AbuseHandlerService } from "./abuse-handler.service";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { CancellationService } from "../cancellation/cancellation.service";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { PostcodeValidationService } from "../orchestrator/postcode-validation.service";
import { GhlApiService } from '../ghl/ghl-api.service';

describe("ConversationsService – slot selection detection", () => {
  let service: ConversationsService;

  // Re-usable slot fixture returned by the mock SlotProvider
  const mockAvailableSlots = [
    { date: "2026-03-24", startTime: "14:00", endTime: "14:30" }, // Tuesday 2pm
    { date: "2026-03-25", startTime: "10:00", endTime: "10:30" }, // Wednesday 10am
    { date: "2026-03-26", startTime: "15:00", endTime: "15:30" }, // Thursday 3pm
  ];

  // Previously offered slots already stored on the conversation document
  const offeredSlots = [
    {
      dateTime: new Date("2026-03-24T14:00:00"),
      displayText: "Tuesday 24th March at 2pm",
    },
    {
      dateTime: new Date("2026-03-25T10:00:00"),
      displayText: "Wednesday 25th March at 10am",
    },
    {
      dateTime: new Date("2026-03-26T15:00:00"),
      displayText: "Thursday 26th March at 3pm",
    },
  ];

  const mockConversationWithSlots = {
    _id: "conv1",
    clinicId: "clinic1",
    leadId: "lead1",
    channel: "website",
    phase: "booking",
    offeredSlots,
  };

  const mockConversationNoSlots = {
    _id: "conv1",
    clinicId: "clinic1",
    leadId: "lead1",
    channel: "website",
    phase: "greeting",
    offeredSlots: [],
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
    issue: "Back Pain",
    ghlContactId: 'ghl_contact_001',
  };

  const mockConversationModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  };
  const mockMessageModel = {
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
    create: jest.fn().mockResolvedValue({}),
  };
  const mockClinicModel = { findById: jest.fn().mockResolvedValue(mockClinic) };
  const mockLeadModel = {
    findById: jest.fn().mockResolvedValue(mockLead),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  };
  const mockChatService = {
    sendMessage: jest.fn().mockResolvedValue("AI reply"),
  };
  const mockSlotProvider = {
    getAvailableSlots: jest.fn().mockResolvedValue(mockAvailableSlots),
  };
  const mockAbuseHandler = { handle: jest.fn().mockResolvedValue(null) };
  const mockAppointmentsService = {
    bookAppointment: jest
      .fn()
      .mockResolvedValue({ success: true, confirmationMessage: "Booked!" }),
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
    escalateEmergency: jest.fn(),
    handleNoSlotsForUrgent: jest.fn(),
    notifyClinicStaff: jest.fn(),
    updateGhlTags: jest.fn().mockResolvedValue(undefined),
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
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    jest.clearAllMocks();
    // Restore defaults after clearAllMocks
    mockChatService.sendMessage.mockResolvedValue("AI reply");
    mockSlotProvider.getAvailableSlots.mockResolvedValue(mockAvailableSlots);
    mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    mockMessageModel.create.mockResolvedValue({});
    mockClinicModel.findById.mockResolvedValue(mockClinic);
    mockLeadModel.findById.mockResolvedValue(mockLead);
    mockMessageModel.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });
    mockAppointmentsService.bookAppointment.mockResolvedValue({
      success: true,
      confirmationMessage: "Booked!",
    });
    mockUrgencyPipeline.assessMessage.mockResolvedValue({
      resolved: "routine",
      assessment: {
        level: "routine",
        score: 0.1,
        signals: [],
        isAmbiguous: false,
        requiresEscalation: false,
        emergencyKeywordsMatched: [],
      },
    });
    mockEscalationService.updateGhlTags.mockResolvedValue(undefined);
  });

  /** Registers a conversation document to be returned by findById */
  function useConversation(
    conv: typeof mockConversationWithSlots | typeof mockConversationNoSlots,
  ) {
    mockConversationModel.findById.mockResolvedValue(conv);
  }

  it("returns slotSelection: null when no slots were previously offered", async () => {
    useConversation(mockConversationNoSlots);
    const result = await service.sendMessage("conv1", "Hi, can I book?");
    expect(result).not.toBeNull();
    expect(result!.slotSelection).toBeNull();
  });

  it("returns SLOT_SELECTED and auto-books when the lead picks a specific day", async () => {
    useConversation(mockConversationWithSlots);
    const result = await service.sendMessage("conv1", "Tuesday please");
    expect(result!.slotSelection?.intent).toBe("SLOT_SELECTED");
    expect(result!.slotSelection?.selectedSlot?.displayText).toBe(
      "Tuesday 24th March at 2pm",
    );
    expect(mockAppointmentsService.bookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: "clinic1",
        leadId: "lead1",
        conversationId: "conv1",
      }),
    );
    expect(result!.bookingResult?.success).toBe(true);
  });

  it("returns AMBIGUOUS when two slots share the same day and only day is given", async () => {
    const twoTuesdaySlots = [
      {
        dateTime: new Date("2026-03-24T14:00:00"),
        displayText: "Tuesday 24th March at 2pm",
      },
      {
        dateTime: new Date("2026-03-24T16:00:00"),
        displayText: "Tuesday 24th March at 4pm",
      },
    ];
    mockConversationModel.findById.mockResolvedValue({
      ...mockConversationWithSlots,
      offeredSlots: twoTuesdaySlots,
    });
    const result = await service.sendMessage("conv1", "Tuesday");
    expect(result!.slotSelection?.intent).toBe("AMBIGUOUS");
    expect(result!.slotSelection?.ambiguousSlots).toHaveLength(2);
  });

  it("returns NONE_SUITABLE and passes selection context to AI", async () => {
    useConversation(mockConversationWithSlots);
    await service.sendMessage("conv1", "None of those work for me");
    // Verify the AI was called with selection context containing NONE_SUITABLE
    const callArgs = mockChatService.sendMessage.mock.calls[0];
    const options = callArgs[4]; // 5th argument: options
    expect(options.slotOptions.selectionContext?.intent).toBe("NONE_SUITABLE");
  });

  it("returns DIFFERENT_DATE and fetches slots for requested day", async () => {
    useConversation(mockConversationWithSlots);
    const result = await service.sendMessage(
      "conv1",
      "Do you have anything on Friday?",
    );
    expect(result!.slotSelection?.intent).toBe("DIFFERENT_DATE");
    expect(result!.slotSelection?.requestedDate).toBe("Friday");
    expect(mockSlotProvider.getAvailableSlots).toHaveBeenCalled();
  });

  it("returns DIFFERENT_TIME and filters slots to morning band", async () => {
    useConversation(mockConversationWithSlots);
    const result = await service.sendMessage(
      "conv1",
      "Do you have anything earlier in the morning?",
    );
    expect(result!.slotSelection?.intent).toBe("DIFFERENT_TIME");
    expect(result!.slotSelection?.timePreference).toBe("morning");
    // Wednesday 10am is the only morning slot in the mock data
    expect(
      (result!.offeredSlots as Array<{ displayText: string }>).some((s) =>
        s.displayText.includes("10am"),
      ),
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // DAY_OVERVIEW (week-range) flow
  // ---------------------------------------------------------------------------
  describe("DAY_OVERVIEW flow", () => {
    it('triggers DAY_OVERVIEW for "this week" and sets awaitingDaySelection', async () => {
      useConversation(mockConversationNoSlots);
      const result = await service.sendMessage(
        "conv1",
        "What do you have this week?",
      );
      expect(result!.slotSelection?.intent).toBe("DAY_OVERVIEW");
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        expect.objectContaining({ awaitingDaySelection: true }),
      );
    });

    it('triggers DAY_OVERVIEW for "next week"', async () => {
      useConversation(mockConversationNoSlots);
      const result = await service.sendMessage("conv1", "next week please");
      expect(result!.slotSelection?.intent).toBe("DAY_OVERVIEW");
    });

    it("picks a day when awaitingDaySelection and user says a day name", async () => {
      const awaitingConv = {
        ...mockConversationNoSlots,
        awaitingDaySelection: true,
        lastRequestedDateStart: new Date("2026-03-23"),
        lastRequestedDateEnd: new Date("2026-03-28"),
      };
      mockConversationModel.findById.mockResolvedValue(awaitingConv);
      const result = await service.sendMessage("conv1", "Tuesday please");
      expect(result!.slotSelection?.intent).toBe("DIFFERENT_DATE");
      expect(result!.slotSelection?.requestedDate).toBe("Tuesday");
      // Should clear awaitingDaySelection
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        expect.objectContaining({ awaitingDaySelection: false }),
      );
    });

    it('detects time filter during awaitingDaySelection (e.g. "what days have 12pm free?")', async () => {
      const awaitingConv = {
        ...mockConversationNoSlots,
        awaitingDaySelection: true,
        lastRequestedDateStart: new Date("2026-03-23"),
        lastRequestedDateEnd: new Date("2026-03-28"),
      };
      mockConversationModel.findById.mockResolvedValue(awaitingConv);
      const result = await service.sendMessage(
        "conv1",
        "what days have 2pm free?",
      );
      expect(result!.slotSelection?.intent).toBe("DAY_OVERVIEW");
      expect(result!.slotSelection?.timePreference).toBe("2pm");
    });

    it("transitions out of awaitingDaySelection on non-specific reply", async () => {
      const awaitingConv = {
        ...mockConversationNoSlots,
        awaitingDaySelection: true,
        lastRequestedDateStart: new Date("2026-03-23"),
        lastRequestedDateEnd: new Date("2026-03-28"),
      };
      mockConversationModel.findById.mockResolvedValue(awaitingConv);
      const result = await service.sendMessage("conv1", "yes please");
      expect(result!.slotSelection?.intent).toBe("DIFFERENT_DATE");
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        expect.objectContaining({ awaitingDaySelection: false }),
      );
    });

    it('detects new date range during awaitingDaySelection (e.g. "first week of June")', async () => {
      const awaitingConv = {
        ...mockConversationNoSlots,
        awaitingDaySelection: true,
        lastRequestedDateStart: new Date("2026-03-23"),
        lastRequestedDateEnd: new Date("2026-03-28"),
      };
      mockConversationModel.findById.mockResolvedValue(awaitingConv);
      const result = await service.sendMessage(
        "conv1",
        "what about the first week of June?",
      );
      expect(result!.slotSelection?.intent).toBe("DIFFERENT_DATE");
    });
  });

  // ---------------------------------------------------------------------------
  // FURTHER_DATE flow
  // ---------------------------------------------------------------------------
  describe("FURTHER_DATE flow", () => {
    it("triggers FURTHER_DATE when lead asks for furthest dates", async () => {
      useConversation(mockConversationWithSlots);
      const result = await service.sendMessage(
        "conv1",
        "what is the furthest date you have?",
      );
      expect(result!.slotSelection?.intent).toBe("FURTHER_DATE");
    });
  });

  // ---------------------------------------------------------------------------
  // Emergency escalation
  // ---------------------------------------------------------------------------
  describe("emergency escalation", () => {
    it("escalates emergency and returns early", async () => {
      useConversation(mockConversationNoSlots);
      mockUrgencyPipeline.assessMessage.mockResolvedValueOnce({
        resolved: "emergency",
        assessment: {
          level: "emergency",
          score: 1.0,
          signals: [],
          isAmbiguous: false,
          requiresEscalation: true,
          emergencyKeywordsMatched: ["chest pain"],
        },
      });
      mockEscalationService.escalateEmergency.mockResolvedValueOnce({
        aiMessage: "Please call 999 immediately.",
      });

      const result = await service.sendMessage(
        "conv1",
        "I have severe chest pain",
      );
      expect(result!.reply).toContain("999");
      expect(mockEscalationService.escalateEmergency).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Urgency update
  // ---------------------------------------------------------------------------
  describe("urgency update", () => {
    it("updates lead urgency when it changes", async () => {
      useConversation(mockConversationNoSlots);
      mockUrgencyPipeline.assessMessage.mockResolvedValueOnce({
        resolved: "urgent",
        assessment: {
          level: "urgent",
          score: 0.7,
          signals: [],
          isAmbiguous: false,
          requiresEscalation: false,
          emergencyKeywordsMatched: [],
        },
      });

      await service.sendMessage("conv1", "I really need to be seen soon");
      expect(mockLeadModel.findByIdAndUpdate).toHaveBeenCalledWith("lead1", {
        urgency: "urgent",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Single-day request returns multiple slots
  // ---------------------------------------------------------------------------
  describe("single-day request", () => {
    it("returns multiple slots for a specific day request", async () => {
      useConversation(mockConversationNoSlots);
      // Provide multiple slots on the same day
      mockSlotProvider.getAvailableSlots.mockResolvedValueOnce([
        { date: "2026-07-06", startTime: "09:00", endTime: "09:30" },
        { date: "2026-07-06", startTime: "11:00", endTime: "11:30" },
        { date: "2026-07-06", startTime: "14:00", endTime: "14:30" },
        { date: "2026-07-06", startTime: "16:00", endTime: "16:30" },
      ]);

      const result = await service.sendMessage("conv1", "Monday 6th July");
      expect(result!.slotSelection?.intent).toBe("DIFFERENT_DATE");
      // Should return up to 3 slots for that day
      expect(result!.offeredSlots.length).toBeLessThanOrEqual(3);
      expect(result!.offeredSlots.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Week range with time preference
  // ---------------------------------------------------------------------------
  describe("week range with time preference", () => {
    it('extracts time from "I want a 12pm slot next week"', async () => {
      useConversation(mockConversationNoSlots);
      const result = await service.sendMessage(
        "conv1",
        "I want a 12pm slot next week",
      );
      expect(result!.slotSelection?.intent).toBe("DAY_OVERVIEW");
      expect(result!.slotSelection?.timePreference).toBe("12pm");
    });
  });
});
