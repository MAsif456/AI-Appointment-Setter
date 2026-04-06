/**
 * Unit tests for OrchestratorService.handleInboundMessage().
 *
 * After the delegation refactor, the orchestrator handles channel-specific
 * concerns (email stripping, auto-reply detection, GHL delivery) and delegates
 * the full AI pipeline to ConversationsService.sendMessage().
 *
 * Tests for intent detection, phase advancement, urgency, booking, and security
 * are covered in conversations.service.spec.ts — not duplicated here.
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
import { FALLBACK_AI_UNAVAILABLE } from "./orchestrator.types";

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
const mockGhlConversationsService = {
  findByGhlContactId: jest.fn(),
  createForNewLead: jest.fn(),
  updatePhase: jest.fn(),
  flagForHumanIntervention: jest.fn(),
  setContext: jest.fn(),
  findLeadById: jest.fn(),
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
const mockSecurityPipeline = {
  processInbound: jest.fn(),
  validateOutput: jest.fn(),
};
const mockChatConversationsService = { sendMessage: jest.fn() };

const clinicConfig: ClinicConfig = {
  clinicId: "507f1f77bcf86cd799439013",
  name: "Cardiff Physiotherapy Centre",
  tone: "Friendly",
  serviceAreas: ["CF", "NP"],
  ghlLocationId: "loc_cardiff_001",
  isActive: true,
};

const mockConversation = {
  _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
  leadId: new Types.ObjectId("507f1f77bcf86cd799439012"),
  channel: "sms",
  phase: "qualifying",
};

describe("OrchestratorService — handleInboundMessage", () => {
  let service: OrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: GreetingService, useValue: mockGreetingService },
        { provide: GroqService, useValue: mockGroqService },
        { provide: CancellationService, useValue: mockCancellationService },
        {
          provide: ConversationsService,
          useValue: mockGhlConversationsService,
        },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: GhlApiService, useValue: mockGhlApiService },
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
          useValue: mockChatConversationsService,
        },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    // Happy-path defaults
    mockGhlConversationsService.findByGhlContactId.mockResolvedValue(
      mockConversation,
    );
    mockGhlConversationsService.createForNewLead.mockResolvedValue(
      mockConversation,
    );
    mockChatConversationsService.sendMessage.mockResolvedValue({
      reply: "AI pipeline response",
      offeredSlots: [],
      slotSelection: null,
      bookingResult: null,
    });
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: "msg_001" });
  });

  afterEach(() => jest.restoreAllMocks());

  it("should return early without loading the conversation when contactId is absent", async () => {
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        message: { body: "Hi" },
      } as any,
      clinicConfig,
    );
    expect(
      mockGhlConversationsService.findByGhlContactId,
    ).not.toHaveBeenCalled();
  });

  it("should create a new conversation when none is found for the contact", async () => {
    mockGhlConversationsService.findByGhlContactId.mockResolvedValue(null);
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "Hi" },
      } as any,
      clinicConfig,
    );
    expect(mockGhlConversationsService.createForNewLead).toHaveBeenCalled();
  });

  it("should return early when new conversation creation fails", async () => {
    mockGhlConversationsService.findByGhlContactId.mockResolvedValue(null);
    mockGhlConversationsService.createForNewLead.mockRejectedValue(
      new Error("DB error"),
    );
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "Hi" },
      } as any,
      clinicConfig,
    );
    expect(mockChatConversationsService.sendMessage).not.toHaveBeenCalled();
  });

  it("should delegate to ChatConversationsService.sendMessage with correct args", async () => {
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "Tell me more" },
      } as any,
      clinicConfig,
    );
    expect(mockChatConversationsService.sendMessage).toHaveBeenCalledWith(
      mockConversation._id.toHexString(),
      "Tell me more",
    );
  });

  it("should send the AI pipeline reply via GHL", async () => {
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "Hi" },
      } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: "AI pipeline response" }),
    );
  });

  it("should send FALLBACK_AI_UNAVAILABLE when sendMessage throws", async () => {
    mockChatConversationsService.sendMessage.mockRejectedValue(
      new Error("Pipeline failure"),
    );
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "Hi" },
      } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: FALLBACK_AI_UNAVAILABLE }),
    );
    expect(
      mockGhlConversationsService.flagForHumanIntervention,
    ).toHaveBeenCalled();
  });

  it("should pass emailMessageId through to sendMessageWithRetry for email threading", async () => {
    mockGhlConversationsService.findByGhlContactId.mockResolvedValue({
      ...mockConversation,
      channel: "email",
      ghlConversationId: "conv_001",
    });
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: {
          body: "Hi there",
          type: "Email",
          emailMessageId: "msg-id-abc-123",
        },
      } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ emailMessageId: "msg-id-abc-123" }),
    );
  });

  it("should send Email type with html and subject for email channel", async () => {
    mockGhlConversationsService.findByGhlContactId.mockResolvedValue({
      ...mockConversation,
      channel: "email",
      ghlConversationId: "conv_001",
    });
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "Hello", type: "Email" },
      } as any,
      clinicConfig,
    );
    const sendCall = mockGhlApiService.sendMessageWithRetry.mock.calls[0][0];
    expect(sendCall.type).toBe("Email");
    expect(sendCall.html).toBeDefined();
    expect(sendCall.subject).toBeDefined();
  });

  it("should silently drop auto-reply emails without delegating to sendMessage", async () => {
    mockGhlConversationsService.findByGhlContactId.mockResolvedValue({
      ...mockConversation,
      channel: "email",
    });
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: {
          body: "I am currently out of the office",
          type: "Email",
          subject: "Out of Office",
        },
      } as any,
      clinicConfig,
    );
    expect(mockChatConversationsService.sendMessage).not.toHaveBeenCalled();
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  it("should send empty-email fallback when stripped content is empty", async () => {
    mockGhlConversationsService.findByGhlContactId.mockResolvedValue({
      ...mockConversation,
      channel: "email",
    });
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "", type: "Email" },
      } as any,
      clinicConfig,
    );
    expect(mockChatConversationsService.sendMessage).not.toHaveBeenCalled();
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("attachment"),
      }),
    );
  });

  it("should pass conversationId to GHL for email threading", async () => {
    mockGhlConversationsService.findByGhlContactId.mockResolvedValue({
      ...mockConversation,
      channel: "email",
      ghlConversationId: "conv_thread_001",
    });
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "Hello", type: "Email" },
      } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv_thread_001" }),
    );
  });

  it("should continue sending via GHL even when sendMessage throws", async () => {
    mockChatConversationsService.sendMessage.mockRejectedValue(
      new Error("DB down"),
    );
    await service.handleInboundMessage(
      {
        type: "InboundMessage",
        location: { id: "loc_001" },
        id: "contact_001",
        message: { body: "Hi" },
      } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalled();
  });
});
