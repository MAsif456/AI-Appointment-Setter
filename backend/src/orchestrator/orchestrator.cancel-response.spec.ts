/**
 * Unit tests for OrchestratorService cancellation response generation.
 * Covers CANCEL, CONFIRM_CANCEL, and DECLINE_CANCEL intent handling.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import {
  OrchestratorService,
  OrchestratorContext,
} from "./orchestrator.service";
import { GreetingService } from "../ai/greeting.service";
import { GroqService } from "../ai/groq.service";
import { CancellationService } from "../cancellation/cancellation.service";
import { ConversationsService } from "../ghl/conversations.service";
import { MessagesService } from "../ghl/messages.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { PostcodeValidationService } from "./postcode-validation.service";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { ConversationsService as ChatConversationsService } from "../conversations/conversations.service";
import { SlotProvider } from "../ai/slot-provider";
import { AppointmentsService } from "../appointments/appointments.service";
import { ConsentService } from "../gdpr/consent/consent.service";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";

const mockSlotProvider = { getAvailableSlots: jest.fn() };
const mockAppointmentsService = { bookAppointment: jest.fn() };

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

const clinicConfig: ClinicConfig = {
  clinicId: "507f1f77bcf86cd799439013",
  name: "Cardiff Physiotherapy Centre",
  tone: "Friendly",
  serviceAreas: ["CF", "NP"],
  ghlLocationId: "loc_cardiff_001",
  isActive: true,
};

const convId = "507f1f77bcf86cd799439011";
const baseContext: OrchestratorContext = {
  clinicId: clinicConfig.clinicId,
  ghlContactId: "contact_123",
  conversationId: convId,
  phase: "booked",
  messages: [],
  patientInfo: { firstName: "Sarah" },
};

describe("OrchestratorService — cancellation responses", () => {
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
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe("CANCEL intent", () => {
    it("should return no-booking message when no appointment exists", async () => {
      mockCancellationService.checkAppointmentExists.mockResolvedValue(null);

      const result = await service.generateResponse(
        { intent: "CANCEL" },
        baseContext,
        clinicConfig,
      );

      expect(result).toContain("don't have a booking on file");
    });

    it("should return confirmation prompt when appointment exists", async () => {
      const mockAppointment = {
        _id: new Types.ObjectId(),
        appointmentDate: new Date(),
      };
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.buildConfirmationPrompt.mockReturnValue(
        "Just to confirm, you'd like to cancel your appointment on Tuesday 17th March at 2:00 PM. Is that correct?",
      );

      const result = await service.generateResponse(
        { intent: "CANCEL" },
        baseContext,
        clinicConfig,
      );

      expect(result).toContain("Just to confirm");
      expect(result).toContain("Is that correct?");
    });

    it("should return no-booking message when conversationId is missing", async () => {
      const noConvContext = { ...baseContext, conversationId: undefined };
      const result = await service.generateResponse(
        { intent: "CANCEL" },
        noConvContext,
        clinicConfig,
      );
      expect(result).toContain("don't have a booking on file");
    });
  });

  describe("CONFIRM_CANCEL intent", () => {
    const cancellingContext = { ...baseContext, phase: "cancelling" };
    const warnedContext = { ...baseContext, phase: "cancelling_warned" };
    const mockAppointment = {
      _id: new Types.ObjectId(),
      appointmentDate: new Date(),
    };

    it("should ask for reason before executing when not yet requested", async () => {
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

      const result = await service.generateResponse(
        { intent: "CONFIRM_CANCEL" },
        cancellingContext,
        clinicConfig,
      );

      expect(result).toContain("reason for cancelling");
      expect(
        mockCancellationService.executeCancellation,
      ).not.toHaveBeenCalled();
    });

    it("should execute cancellation when reason already requested (>24h)", async () => {
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.evaluatePolicy.mockResolvedValue({
        withinNotice: false,
        feeEnabled: false,
      });
      mockCancellationService.isAwaitingReason.mockResolvedValue(true);
      mockCancellationService.executeCancellation.mockResolvedValue({
        success: true,
        message:
          "Your appointment has been cancelled. Feel free to book again anytime!",
      });

      const result = await service.generateResponse(
        { intent: "CONFIRM_CANCEL" },
        cancellingContext,
        clinicConfig,
      );

      expect(result).toContain("cancelled");
      expect(mockCancellationService.executeCancellation).toHaveBeenCalled();
    });

    it("should return fee warning when within notice period and fee enabled", async () => {
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.evaluatePolicy.mockResolvedValue({
        withinNotice: true,
        feeEnabled: true,
        feeDescription: "£50",
        warningMessage:
          "Cancellations within 24 hours may incur a fee of £50. Would you like to proceed or reschedule instead?",
      });

      const result = await service.generateResponse(
        { intent: "CONFIRM_CANCEL" },
        cancellingContext,
        clinicConfig,
      );

      expect(result).toContain("incur a fee");
      expect(result).toContain("£50");
      expect(
        mockCancellationService.executeCancellation,
      ).not.toHaveBeenCalled();
    });

    it("should execute cancellation from cancelling_warned when reason already asked", async () => {
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.isAwaitingReason.mockResolvedValue(true);
      mockCancellationService.executeCancellation.mockResolvedValue({
        success: true,
        message:
          "Your appointment has been cancelled. Feel free to book again anytime!",
      });

      const result = await service.generateResponse(
        { intent: "CONFIRM_CANCEL" },
        warnedContext,
        clinicConfig,
      );

      expect(result).toContain("cancelled");
      expect(mockCancellationService.executeCancellation).toHaveBeenCalled();
      expect(mockCancellationService.evaluatePolicy).not.toHaveBeenCalled();
    });
  });

  describe("UNKNOWN intent in cancelling phase (reason collection)", () => {
    const cancellingContext = {
      ...baseContext,
      phase: "cancelling",
      messages: [
        {
          role: "user" as const,
          content: "Moving away from the area",
          timestamp: new Date(),
        },
      ],
    };
    const mockAppointment = {
      _id: new Types.ObjectId(),
      appointmentDate: new Date(),
    };

    it("should store reason and execute cancellation when awaiting reason", async () => {
      mockCancellationService.isAwaitingReason.mockResolvedValue(true);
      mockCancellationService.storeReason.mockResolvedValue(undefined);
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.executeCancellation.mockResolvedValue({
        success: true,
        message:
          "Your appointment has been cancelled. Thank you for letting us know.",
      });

      const result = await service.generateResponse(
        { intent: "UNKNOWN" },
        cancellingContext,
        clinicConfig,
      );

      expect(result).toContain("cancelled");
      expect(mockCancellationService.storeReason).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        "Moving away from the area",
      );
      expect(mockCancellationService.executeCancellation).toHaveBeenCalled();
    });

    it("should return fallback when not awaiting reason", async () => {
      mockCancellationService.isAwaitingReason.mockResolvedValue(false);

      const result = await service.generateResponse(
        { intent: "UNKNOWN" },
        cancellingContext,
        clinicConfig,
      );

      expect(
        mockCancellationService.executeCancellation,
      ).not.toHaveBeenCalled();
    });

    it("should handle cancelling_warned phase with reason collection", async () => {
      const warnedCtx = { ...cancellingContext, phase: "cancelling_warned" };
      mockCancellationService.isAwaitingReason.mockResolvedValue(true);
      mockCancellationService.storeReason.mockResolvedValue(undefined);
      mockCancellationService.checkAppointmentExists.mockResolvedValue(
        mockAppointment,
      );
      mockCancellationService.executeCancellation.mockResolvedValue({
        success: true,
        message: "Your appointment has been cancelled.",
      });

      const result = await service.generateResponse(
        { intent: "UNKNOWN" },
        warnedCtx,
        clinicConfig,
      );

      expect(result).toContain("cancelled");
      expect(mockCancellationService.storeReason).toHaveBeenCalled();
    });
  });

  describe("DECLINE_CANCEL intent", () => {
    it("should reassure appointment is kept when declining from cancelling phase", async () => {
      const ctx = { ...baseContext, phase: "cancelling" };
      const result = await service.generateResponse(
        { intent: "DECLINE_CANCEL" },
        ctx,
        clinicConfig,
      );

      expect(result).toContain("still confirmed");
    });

    it("should offer rescheduling when declining from cancelling_warned phase", async () => {
      const ctx = { ...baseContext, phase: "cancelling_warned" };
      const result = await service.generateResponse(
        { intent: "DECLINE_CANCEL" },
        ctx,
        clinicConfig,
      );

      expect(result).toContain("rescheduling");
    });
  });
});
