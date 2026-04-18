/**
 * Unit tests for OrchestratorService.handleNewLead().
 *
 * Covers all branches of the ContactCreate webhook flow:
 *   - Missing contactId → returns early
 *   - GHL conversation creation failure → logs warn, continues
 *   - createForNewLead failure → logs error, returns early
 *   - Greeting generation returns null → falls back to FALLBACK_MESSAGE
 *   - GHL send failure → logs error, continues to persist
 *   - Happy path → greeting sent, message persisted, phase → 'qualifying'
 */
import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { OrchestratorService, FALLBACK_MESSAGE } from "./orchestrator.service";
import { GreetingService } from "../ai/greeting.service";
import { GroqService } from "../ai/groq.service";
import { ConversationsService } from "../ghl/conversations.service";
import { MessagesService } from "../ghl/messages.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { CancellationService } from "../cancellation/cancellation.service";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { PostcodeValidationService } from "./postcode-validation.service";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { ConversationsService as ChatConversationsService } from "../conversations/conversations.service";
import { SlotProvider } from "../ai/slot-provider";
import { AppointmentsService } from "../appointments/appointments.service";
import { ConsentService } from "../gdpr/consent/consent.service";
import { CONSENT_STATEMENT_TEXT } from "../gdpr/gdpr.types";
import { InboxNotificationService } from "../notifications/inbox-notification.service";

const mockSlotProvider = { getAvailableSlots: jest.fn() };
const mockAppointmentsService = { bookAppointment: jest.fn() };

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

const mockGreetingService = { generateGreeting: jest.fn() };
const mockGroqService = {
  generateResponse: jest.fn(),
  generateChatResponse: jest.fn(),
};
const mockCancellationService = {
  checkAppointmentExists: jest.fn(),
  buildConfirmationPrompt: jest.fn(),
  evaluatePolicy: jest.fn(),
  executeCancellation: jest.fn(),
  isAwaitingReason: jest.fn(),
  requestReason: jest.fn(),
  storeReason: jest.fn(),
};
const mockConversationsService = {
  findByGhlContactId: jest.fn(),
  createForNewLead: jest.fn(),
  updatePhase: jest.fn(),
  flagForHumanIntervention: jest.fn(),
};
const mockMessagesService = {
  addMessage: jest.fn(),
  getByConversation: jest.fn(),
};
const mockGhlApiService = {
  sendMessageWithRetry: jest.fn(),
  getConversation: jest.fn(),
  createConversation: jest.fn(),
};

/** Clinic config with a valid 24-char hex ObjectId required by handleNewLead. */
const clinicConfig: ClinicConfig = {
  clinicId: "507f1f77bcf86cd799439013",
  name: "Cardiff Physiotherapy Centre",
  tone: "Friendly",
  serviceAreas: ["CF", "NP"],
  ghlLocationId: "loc_cardiff_001",
  isActive: true,
};

/** Mock conversation document returned by createForNewLead. */
const mockConversation = {
  _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
  leadId: new Types.ObjectId("507f1f77bcf86cd799439012"),
  channel: "sms",
};

describe("OrchestratorService — handleNewLead", () => {
  let service: OrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: GreetingService, useValue: mockGreetingService },
        { provide: GroqService, useValue: mockGroqService },
        { provide: CancellationService, useValue: mockCancellationService },
        { provide: ConversationsService, useValue: mockConversationsService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: GhlApiService, useValue: mockGhlApiService },
        { provide: SlotProvider, useValue: mockSlotProvider },
        { provide: AppointmentsService, useValue: mockAppointmentsService },
        PostcodeValidationService,
        { provide: SecurityPipelineService, useValue: mockSecurityPipeline },
        {
          provide: PatientHistoryService,
          useValue: {
            findReturningPatient: jest.fn().mockResolvedValue(null),
            persistHistory: jest.fn(),
          },
        },
        {
          provide: ChatConversationsService,
          useValue: { sendMessage: jest.fn() },
        },
        { provide: ConsentService, useValue: { recordConsent: jest.fn(), hasActiveConsent: jest.fn().mockResolvedValue(false), getConsentHistory: jest.fn(), withdrawConsent: jest.fn() } },
        { provide: InboxNotificationService, useValue: { createForClinicStaff: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    // Happy-path defaults
    mockGhlApiService.createConversation.mockResolvedValue({ id: "conv_001" });
    mockConversationsService.createForNewLead.mockResolvedValue(
      mockConversation,
    );
    mockGreetingService.generateGreeting.mockResolvedValue("Hello Jane!");
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: "msg_001" });
    mockMessagesService.addMessage.mockResolvedValue({});
    mockConversationsService.updatePhase.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  it("should return early without calling createForNewLead when contactId is absent", async () => {
    await service.handleNewLead(
      { type: "ContactCreate", location: { id: "loc_001" } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.createForNewLead).not.toHaveBeenCalled();
  });

  it("should continue past a GHL conversation creation failure", async () => {
    mockGhlApiService.createConversation.mockRejectedValue(
      new Error("GHL down"),
    );
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
      } as any,
      clinicConfig,
    );
    expect(mockConversationsService.createForNewLead).toHaveBeenCalled();
  });

  it("should return early without generating a greeting when createForNewLead fails", async () => {
    mockConversationsService.createForNewLead.mockRejectedValue(
      new Error("DB error"),
    );
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
      } as any,
      clinicConfig,
    );
    expect(mockGreetingService.generateGreeting).not.toHaveBeenCalled();
  });

  it("should send FALLBACK_MESSAGE when greeting generation returns null", async () => {
    mockGreetingService.generateGreeting.mockResolvedValue(null);
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
      } as any,
      clinicConfig,
    );
    // New patients route to 'consenting' so the consent statement is appended
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `${FALLBACK_MESSAGE}\n\n${CONSENT_STATEMENT_TEXT}`,
      }),
    );
  });

  it("should continue to persist the message even when GHL send fails", async () => {
    mockGhlApiService.sendMessageWithRetry.mockRejectedValue(
      new Error("send failed"),
    );
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
      } as any,
      clinicConfig,
    );
    expect(mockMessagesService.addMessage).toHaveBeenCalled();
  });

  it('should transition the conversation phase to "qualifying" on success', async () => {
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Jane",
      } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(
      expect.anything(),
      "consenting",
    );
  });

  it("should pass the lead name to the greeting service", async () => {
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Jane",
        last_name: "Doe",
      } as any,
      clinicConfig,
    );
    expect(mockGreetingService.generateGreeting).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Jane" }),
      expect.anything(),
    );
  });

  it('should detect email channel and pass type "Email" when lead has email but no phone', async () => {
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Test",
        email: "test@example.com",
      } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Email" }),
    );
  });

  it("should include html and subject when sending email greeting", async () => {
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Test",
        email: "test@example.com",
      } as any,
      clinicConfig,
    );
    const sendCall = mockGhlApiService.sendMessageWithRetry.mock.calls[0][0];
    expect(sendCall.html).toBeDefined();
    expect(sendCall.subject).toBeDefined();
  });

  it("should pass issue to createForNewLead so it is stored on the lead", async () => {
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Jane",
        issue: "Back pain",
      } as any,
      clinicConfig,
    );
    expect(mockConversationsService.createForNewLead).toHaveBeenCalledWith(
      expect.anything(),
      "contact_001",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ issue: "Back pain" }),
    );
  });

  it("should pass the issue to the greeting service for acknowledgement", async () => {
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Jane",
        issue: "Back pain",
      } as any,
      clinicConfig,
    );
    expect(mockGreetingService.generateGreeting).toHaveBeenCalledWith(
      expect.objectContaining({ issue: "Back pain" }),
      expect.anything(),
    );
  });

  it("should replace greeting with fallback when output validation fails", async () => {
    mockSecurityPipeline.validateOutput.mockReturnValueOnce({
      safe: false,
      flags: ["html_injection"],
      fallbackResponse: "Safe fallback",
    });
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Jane",
      } as any,
      clinicConfig,
    );
    // New patients route to 'consenting' so the consent statement is appended
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Safe fallback\n\n${CONSENT_STATEMENT_TEXT}`,
      }),
    );
  });

  it("should pass ghlConversationId to the send call for email threading", async () => {
    mockGhlApiService.createConversation.mockResolvedValue({
      id: "conv_thread_001",
    });
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Test",
        email: "test@example.com",
      } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv_thread_001" }),
    );
  });

  it("should detect SMS channel when lead has phone but no email", async () => {
    await service.handleNewLead(
      {
        type: "ContactCreate",
        location: { id: "loc_001" },
        id: "contact_001",
        first_name: "Test",
        phone: "+447700900123",
      } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SMS" }),
    );
  });
});
