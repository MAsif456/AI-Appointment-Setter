/**
 * Integration-level tests for the OrchestratorService returning patient flow.
 *
 * Covers:
 *   7.  DETAILS_UNCHANGED -> intent detected correctly
 *   8.  DETAILS_CHANGED -> intent detected correctly
 *   9.  RETURNING_PATIENT_DETECTED analytics event logged when match found
 *   10. New patient uses standard greeting and qualifying phase
 */
import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { OrchestratorService } from "../orchestrator/orchestrator.service";
import { GreetingService } from "../ai/greeting.service";
import { GroqService } from "../ai/groq.service";
import { ConversationsService } from "../ghl/conversations.service";
import { MessagesService } from "../ghl/messages.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { CancellationService } from "../cancellation/cancellation.service";
import { PostcodeValidationService } from "../orchestrator/postcode-validation.service";
import { PatientHistoryService } from "./patient-history.service";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { ConversationsService as ChatConversationsService } from "../conversations/conversations.service";
import { SlotProvider } from "../ai/slot-provider";
import { AppointmentsService } from "../appointments/appointments.service";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { ConsentService } from "../gdpr/consent/consent.service";

const CLINIC_A = "507f1f77bcf86cd799439011";
const CONV_ID = new Types.ObjectId("507f1f77bcf86cd799439033");

const recentRecord = {
  firstName: "Jane",
  lastName: "Doe",
  validatedPostcode: "CF10 1AA",
  previousConversationId: CONV_ID,
  lastBookedAt: new Date(Date.now() - 10 * 86_400_000),
};

const mockConversation = {
  _id: new Types.ObjectId("507f1f77bcf86cd799439044"),
  leadId: new Types.ObjectId("507f1f77bcf86cd799439055"),
  channel: "sms",
  phase: "greeting",
  isReturningPatient: true,
  context: new Map([["returningPatientPostcode", "CF10 1AA"]]),
};

const clinicConfig: ClinicConfig = {
  clinicId: CLINIC_A,
  name: "Cardiff Physio",
  tone: "Friendly",
  ghlLocationId: "loc_001",
  isActive: true,
  patientDataExpiryDays: 365,
};

describe("OrchestratorService - returning patient flow", () => {
  let orchestratorService: OrchestratorService;
  let logSpy: jest.SpyInstance;

  const mockGreetingService = {
    generateGreeting: jest.fn().mockResolvedValue("Hello there!"),
    generateReturningPatientGreeting: jest
      .fn()
      .mockResolvedValue("Welcome back, Jane!"),
  };
  const mockConversationsService = {
    findByGhlContactId: jest.fn(),
    createForNewLead: jest.fn().mockResolvedValue(mockConversation),
    updatePhase: jest.fn().mockResolvedValue({}),
    updateReturningPatientFlags: jest.fn().mockResolvedValue({}),
    setContext: jest.fn().mockResolvedValue({}),
    flagForHumanIntervention: jest.fn().mockResolvedValue({}),
  };
  const mockMessagesService = {
    addMessage: jest.fn().mockResolvedValue({}),
    getByConversation: jest.fn().mockResolvedValue([]),
  };
  const mockGhlApiService = {
    createConversation: jest.fn().mockResolvedValue({ id: "conv_001" }),
    sendMessageWithRetry: jest.fn().mockResolvedValue({ id: "msg_001" }),
  };
  const mockPatientHistoryService = {
    findReturningPatient: jest.fn(),
    persistHistory: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: GreetingService, useValue: mockGreetingService },
        {
          provide: GroqService,
          useValue: {
            generateResponse: jest.fn(),
            generateChatResponse: jest.fn(),
          },
        },
        {
          provide: CancellationService,
          useValue: {
            checkAppointmentExists: jest.fn(),
            buildConfirmationPrompt: jest.fn(),
            evaluatePolicy: jest.fn(),
            executeCancellation: jest.fn(),
          },
        },
        { provide: ConversationsService, useValue: mockConversationsService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: GhlApiService, useValue: mockGhlApiService },
        { provide: SlotProvider, useValue: { getAvailableSlots: jest.fn() } },
        { provide: AppointmentsService, useValue: { bookAppointment: jest.fn() } },
        { provide: PatientHistoryService, useValue: mockPatientHistoryService },
        {
          provide: SecurityPipelineService,
          useValue: {
            processInbound: jest.fn().mockImplementation((msg: string) =>
              Promise.resolve({
                allowed: true,
                sanitisedMessage: msg,
                threatScore: 0,
                flags: [],
              }),
            ),
            validateOutput: jest
              .fn()
              .mockReturnValue({ safe: true, flags: [] }),
          },
        },
        PostcodeValidationService,
        {
          provide: ChatConversationsService,
          useValue: { sendMessage: jest.fn() },
        },
        { provide: ConsentService, useValue: { recordConsent: jest.fn(), hasActiveConsent: jest.fn().mockResolvedValue(false), getConsentHistory: jest.fn(), withdrawConsent: jest.fn() } },
      ],
    }).compile();

    orchestratorService = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
    mockGhlApiService.createConversation.mockResolvedValue({ id: "conv_001" });
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: "msg_001" });
    mockConversationsService.createForNewLead.mockResolvedValue(
      mockConversation,
    );
    mockGreetingService.generateGreeting.mockResolvedValue("Hello there!");
    mockGreetingService.generateReturningPatientGreeting.mockResolvedValue(
      "Welcome back, Jane!",
    );
    mockMessagesService.addMessage.mockResolvedValue({});
    mockConversationsService.updatePhase.mockResolvedValue({});
    mockConversationsService.updateReturningPatientFlags.mockResolvedValue({});
    mockConversationsService.setContext.mockResolvedValue({});
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("logs RETURNING_PATIENT_DETECTED when a returning patient is found", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue({
      ...recentRecord,
      confidence: "high",
    });
    await orchestratorService.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        phone: "07911123456",
      } as any,
      clinicConfig,
    );
    const logCalls = logSpy.mock.calls.map((c) => c[0] as string);
    expect(
      logCalls.some((msg) => msg.includes("RETURNING_PATIENT_DETECTED")),
    ).toBe(true);
  });

  it("does not log RETURNING_PATIENT_DETECTED for a new patient", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);
    await orchestratorService.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        phone: "07911123456",
      } as any,
      clinicConfig,
    );
    const logCalls = logSpy.mock.calls.map((c) => c[0] as string);
    expect(
      logCalls.some((msg) => msg.includes("RETURNING_PATIENT_DETECTED")),
    ).toBe(false);
  });

  it("calls generateReturningPatientGreeting for a returning patient", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue({
      ...recentRecord,
      confidence: "high",
    });
    await orchestratorService.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        phone: "07911123456",
      } as any,
      clinicConfig,
    );
    expect(
      mockGreetingService.generateReturningPatientGreeting,
    ).toHaveBeenCalled();
    expect(mockGreetingService.generateGreeting).not.toHaveBeenCalled();
  });

  it("calls generateGreeting for a new patient", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);
    await orchestratorService.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        phone: "07911123456",
      } as any,
      clinicConfig,
    );
    expect(mockGreetingService.generateGreeting).toHaveBeenCalled();
    expect(
      mockGreetingService.generateReturningPatientGreeting,
    ).not.toHaveBeenCalled();
  });

  it("keeps phase as greeting for returning patients", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue({
      ...recentRecord,
      confidence: "high",
    });
    await orchestratorService.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        phone: "07911123456",
      } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(
      expect.anything(),
      "consenting",
    );
  });

  it("advances phase to qualifying for new patients", async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);
    await orchestratorService.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        phone: "07911123456",
      } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(
      expect.anything(),
      "consenting",
    );
  });

  it("detects DETAILS_UNCHANGED intent when phase is greeting and patient is returning (exact single-word)", () => {
    const intent = orchestratorService.detectIntent("yes", "greeting", {
      isReturningPatient: true,
    });
    expect(intent.intent).toBe("DETAILS_UNCHANGED");
  });

  it("detects DETAILS_UNCHANGED intent when phase is greeting and patient is returning (multi-word phrase mid-sentence)", () => {
    const intent = orchestratorService.detectIntent(
      "actually nothing changed for me",
      "greeting",
      { isReturningPatient: true },
    );
    expect(intent.intent).toBe("DETAILS_UNCHANGED");
  });

  it("detects DETAILS_CHANGED intent when phase is greeting and patient is returning (exact single-word)", () => {
    const intent = orchestratorService.detectIntent("moved", "greeting", {
      isReturningPatient: true,
    });
    expect(intent.intent).toBe("DETAILS_CHANGED");
  });

  it("detects DETAILS_CHANGED intent when phase is greeting and patient is returning (multi-word phrase)", () => {
    const intent = orchestratorService.detectIntent(
      "details have changed",
      "greeting",
      { isReturningPatient: true },
    );
    expect(intent.intent).toBe("DETAILS_CHANGED");
  });

  it("does not detect DETAILS_UNCHANGED when isReturningPatient is false", () => {
    const intent = orchestratorService.detectIntent("yes", "greeting", {
      isReturningPatient: false,
    });
    expect(intent.intent).toBe("UNKNOWN");
  });

  it("does not detect DETAILS_CHANGED when isReturningPatient is false", () => {
    const intent = orchestratorService.detectIntent("moved", "greeting", {
      isReturningPatient: false,
    });
    expect(intent.intent).toBe("UNKNOWN");
  });

  it("does not detect DETAILS_UNCHANGED when single-word keyword appears mid-sentence", () => {
    const intent = orchestratorService.detectIntent(
      "yes I have back pain",
      "greeting",
      { isReturningPatient: true },
    );
    expect(intent.intent).toBe("UNKNOWN");
  });
});
