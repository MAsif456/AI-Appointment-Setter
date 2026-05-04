/**
 * Unit tests for OrchestratorService.detectIntent().
 *
 * Covers phase-gated intent detection:
 *   - PROVIDE_POSTCODE: various postcode formats, normalisation, phase-gating
 *   - WANT_TO_BOOK: keyword matching, case-insensitivity, phase-gating
 *   - RESCHEDULE: keyword matching in 'booked' phase, phase-gating
 *   - CANCEL_RESCHEDULE: keyword matching in 'rescheduling' phase, phase-gating
 *   - UNKNOWN: fallback for unrecognised messages
 */
import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { OrchestratorService } from "./orchestrator.service";
import { GreetingService } from "../ai/greeting.service";
import { GroqService } from "../ai/groq.service";
import { ConversationsService } from "../ghl/conversations.service";
import { MessagesService } from "../ghl/messages.service";
import { GhlApiService } from "../ghl/ghl-api.service";
import { CancellationService } from "../cancellation/cancellation.service";
import { PostcodeValidationService } from "./postcode-validation.service";
import { SecurityPipelineService } from "../security/security-pipeline.service";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { ConversationsService as ChatConversationsService } from "../conversations/conversations.service";
import { SlotProvider } from "../ai/slot-provider";
import { AppointmentsService } from "../appointments/appointments.service";
import { ConsentService } from "../gdpr/consent/consent.service";
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

describe("OrchestratorService — detectIntent", () => {
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
  });

  afterEach(() => jest.restoreAllMocks());

  describe("PROVIDE_POSTCODE", () => {
    it("should detect a standard-format postcode (CF10 1AA) in the qualifying phase", () => {
      expect(
        service.detectIntent("My postcode is CF10 1AA", "qualifying").intent,
      ).toBe("PROVIDE_POSTCODE");
    });

    it("should normalise a spaceless lowercase postcode (cf101aa) to uppercase with a space", () => {
      const result = service.detectIntent("cf101aa", "qualifying");
      expect(result.intent).toBe("PROVIDE_POSTCODE");
      if (result.intent === "PROVIDE_POSTCODE") {
        expect(result.data.postcode).toBe("CF10 1AA");
      }
    });

    it("should detect a postcode embedded in a longer sentence", () => {
      expect(
        service.detectIntent(
          "My postcode is CF10 1AA, let me know if that works",
          "qualifying",
        ).intent,
      ).toBe("PROVIDE_POSTCODE");
    });

    it("should normalise a postcode that already has correct spacing (NP20 4NT)", () => {
      const result = service.detectIntent("NP20 4NT", "qualifying");
      expect(result.intent).toBe("PROVIDE_POSTCODE");
      if (result.intent === "PROVIDE_POSTCODE") {
        expect(result.data.postcode).toBe("NP20 4NT");
      }
    });

    it("should normalise a lowercase postcode (np204nt) to uppercase with a space", () => {
      const result = service.detectIntent("np204nt", "qualifying");
      expect(result.intent).toBe("PROVIDE_POSTCODE");
      if (result.intent === "PROVIDE_POSTCODE") {
        expect(result.data.postcode).toBe("NP20 4NT");
      }
    });

    it("should NOT detect a postcode when the phase is greeting", () => {
      expect(service.detectIntent("CF10 1AA", "greeting").intent).toBe(
        "UNKNOWN",
      );
    });

    it("should NOT detect a postcode when the phase is qualified", () => {
      expect(service.detectIntent("CF10 1AA", "qualified").intent).toBe(
        "UNKNOWN",
      );
    });

    it("should NOT detect a postcode when the phase is booking", () => {
      expect(service.detectIntent("CF10 1AA", "booking").intent).toBe(
        "UNKNOWN",
      );
    });
  });

  describe("WANT_TO_BOOK", () => {
    it('should detect the keyword "book" in the qualified phase', () => {
      expect(
        service.detectIntent("I would like to book", "qualified").intent,
      ).toBe("WANT_TO_BOOK");
    });

    it('should detect the keyword "appointment" in the qualified phase', () => {
      expect(
        service.detectIntent("Can I make an appointment?", "qualified").intent,
      ).toBe("WANT_TO_BOOK");
    });

    it('should detect the keyword "schedule" in the qualified phase', () => {
      expect(
        service.detectIntent("Can you schedule me in?", "qualified").intent,
      ).toBe("WANT_TO_BOOK");
    });

    it('should detect the phrase "sign me up" in the qualified phase', () => {
      expect(
        service.detectIntent("Yes, sign me up please", "qualified").intent,
      ).toBe("WANT_TO_BOOK");
    });

    it('should detect the phrase "yes please" in the qualified phase', () => {
      expect(service.detectIntent("yes please", "qualified").intent).toBe(
        "WANT_TO_BOOK",
      );
    });

    it("should be case-insensitive for booking keywords", () => {
      expect(
        service.detectIntent("I want to BOOK an APPOINTMENT", "qualified")
          .intent,
      ).toBe("WANT_TO_BOOK");
    });

    it("should NOT detect booking intent when the phase is qualifying", () => {
      expect(service.detectIntent("I want to book", "qualifying").intent).toBe(
        "UNKNOWN",
      );
    });

    it("should NOT detect booking intent when the phase is greeting", () => {
      expect(service.detectIntent("book me in", "greeting").intent).toBe(
        "UNKNOWN",
      );
    });
  });

  describe("INVALID_POSTCODE_FORMAT", () => {
    it("should return INVALID_POSTCODE_FORMAT for a numeric-only string (12345) in qualifying phase", () => {
      expect(service.detectIntent("12345", "qualifying").intent).toBe(
        "INVALID_POSTCODE_FORMAT",
      );
    });

    it("should return INVALID_POSTCODE_FORMAT for a short alphanumeric string with digit (AB12) in qualifying phase", () => {
      expect(service.detectIntent("AB12", "qualifying").intent).toBe(
        "INVALID_POSTCODE_FORMAT",
      );
    });

    it("should return INVALID_POSTCODE_FORMAT for a random letter string with no digits (ghthhdh)", () => {
      expect(service.detectIntent("ghthhdh", "qualifying").intent).toBe(
        "INVALID_POSTCODE_FORMAT",
      );
    });

    it("should return INVALID_POSTCODE_FORMAT for a mixed random string (c738487)", () => {
      expect(service.detectIntent("c738487", "qualifying").intent).toBe(
        "INVALID_POSTCODE_FORMAT",
      );
    });

    it("should return INVALID_POSTCODE_FORMAT for a postcode with a too-long inward code (CF10 1AAA)", () => {
      expect(service.detectIntent("CF10 1AAA", "qualifying").intent).toBe(
        "INVALID_POSTCODE_FORMAT",
      );
    });

    it("should return UNKNOWN for an invalid-format attempt outside the qualifying phase", () => {
      expect(service.detectIntent("12345", "greeting").intent).toBe("UNKNOWN");
    });

    it("should return UNKNOWN for a very short input (hi) that is below the minimum length", () => {
      expect(service.detectIntent("hi", "qualifying").intent).toBe("UNKNOWN");
    });
  });

  describe("RESCHEDULE", () => {
    it("should detect \"reschedule\" in the booked phase", () => {
      expect(service.detectIntent("I need to reschedule", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"rearrange\" in the booked phase", () => {
      expect(service.detectIntent("Can I rearrange my appointment?", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"change my appointment\" in the booked phase", () => {
      expect(service.detectIntent("I need to change my appointment", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"move my booking\" in the booked phase", () => {
      expect(service.detectIntent("Can I move my booking to another day?", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"can't make it\" in the booked phase", () => {
      expect(service.detectIntent("I can't make it on Tuesday", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"is it possible to reschedule\" in the booked phase", () => {
      expect(service.detectIntent("Is it possible to reschedule?", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"switch my appointment\" in the booked phase", () => {
      expect(service.detectIntent("I need to switch my appointment to another day", "booked").intent).toBe("RESCHEDULE");
    });

    it("should be case-insensitive for reschedule keywords", () => {
      expect(service.detectIntent("I want to RESCHEDULE my APPOINTMENT", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"original appointment\" in the booked phase (post-reschedule reversal)", () => {
      expect(service.detectIntent("I want my original appointment back", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"go back to my original\" in the booked phase", () => {
      expect(service.detectIntent("Can I go back to my original date?", "booked").intent).toBe("RESCHEDULE");
    });

    it("should detect \"undo the reschedule\" in the booked phase", () => {
      expect(service.detectIntent("I want to undo the reschedule", "booked").intent).toBe("RESCHEDULE");
    });

    it("should NOT detect RESCHEDULE when the phase is qualifying (wrong phase)", () => {
      expect(service.detectIntent("I need to change my appointment", "qualifying").intent).toBe("UNKNOWN");
    });

    it("should NOT detect RESCHEDULE when the phase is rescheduling (already rescheduling)", () => {
      expect(service.detectIntent("I need to change my appointment", "rescheduling").intent).toBe("UNKNOWN");
    });

    it("should return UNKNOWN for a general message in the booked phase", () => {
      expect(service.detectIntent("hello", "booked").intent).toBe("UNKNOWN");
    });
  });

  describe("CANCEL_RESCHEDULE", () => {
    it("should detect \"never mind\" in the rescheduling phase", () => {
      expect(service.detectIntent("never mind", "rescheduling").intent).toBe("CANCEL_RESCHEDULE");
    });

    it("should detect \"forget it\" in the rescheduling phase", () => {
      expect(service.detectIntent("Forget it, keep the original", "rescheduling").intent).toBe("CANCEL_RESCHEDULE");
    });

    it("should detect \"keep my original\" in the rescheduling phase", () => {
      expect(service.detectIntent("keep my original appointment please", "rescheduling").intent).toBe("CANCEL_RESCHEDULE");
    });

    it("should detect \"keep my appointment\" in the rescheduling phase", () => {
      expect(service.detectIntent("Actually, keep my appointment", "rescheduling").intent).toBe("CANCEL_RESCHEDULE");
    });

    it("should detect \"actually it's fine\" in the rescheduling phase", () => {
      expect(service.detectIntent("actually it's fine, ignore me", "rescheduling").intent).toBe("CANCEL_RESCHEDULE");
    });

    it("should be case-insensitive for cancel reschedule keywords", () => {
      expect(service.detectIntent("NEVER MIND", "rescheduling").intent).toBe("CANCEL_RESCHEDULE");
    });

    it("should NOT detect CANCEL_RESCHEDULE when the phase is booked (wrong phase)", () => {
      expect(service.detectIntent("never mind", "booked").intent).toBe("UNKNOWN");
    });

    it("should NOT detect CANCEL_RESCHEDULE when the phase is qualifying (wrong phase)", () => {
      // "never mind" stripped = "nevermind" (9 chars, all letters) — caught as INVALID_POSTCODE_FORMAT in qualifying
      expect(service.detectIntent("never mind", "qualifying").intent).toBe("INVALID_POSTCODE_FORMAT");
    });
  });

  describe("UNKNOWN", () => {
    it("should return UNKNOWN for a full sentence with no matching content", () => {
      expect(
        service.detectIntent("I am not sure what I need", "qualifying").intent,
      ).toBe("UNKNOWN");
    });

    it("should return UNKNOWN for an empty message", () => {
      expect(service.detectIntent("", "qualifying").intent).toBe("UNKNOWN");
    });

    it("should return UNKNOWN when the message is a general question", () => {
      expect(
        service.detectIntent("How much does a session cost?", "greeting")
          .intent,
      ).toBe("UNKNOWN");
    });

    it("should return UNKNOWN when the message contains spaces and punctuation (Hi there!)", () => {
      expect(service.detectIntent("Hi there!", "qualifying").intent).toBe(
        "UNKNOWN",
      );
    });
  });

  describe("CANCEL", () => {
    it('should detect "cancel" in the booked phase', () => {
      expect(
        service.detectIntent("I need to cancel my appointment", "booked")
          .intent,
      ).toBe("CANCEL");
    });

    it('should detect "cancel my booking" in the booked phase', () => {
      expect(
        service.detectIntent("Please cancel my booking", "booked").intent,
      ).toBe("CANCEL");
    });

    it('should detect "can\'t come" in the booked phase', () => {
      expect(
        service.detectIntent("I can't come anymore", "booked").intent,
      ).toBe("CANCEL");
    });

    it('should detect "I want to cancel" in the booked phase', () => {
      expect(service.detectIntent("I want to cancel", "booked").intent).toBe(
        "CANCEL",
      );
    });

    it("should be case-insensitive for cancel keywords", () => {
      expect(
        service.detectIntent("CANCEL MY APPOINTMENT", "booked").intent,
      ).toBe("CANCEL");
    });

    it("should NOT detect CANCEL in the qualifying phase", () => {
      expect(
        service.detectIntent("cancel my appointment", "qualifying").intent,
      ).toBe("UNKNOWN");
    });

    it("should NOT detect CANCEL in the booking phase", () => {
      expect(
        service.detectIntent("cancel my appointment", "booking").intent,
      ).toBe("UNKNOWN");
    });
  });

  describe("CONFIRM_CANCEL", () => {
    it('should detect "yes" in the cancelling phase', () => {
      expect(service.detectIntent("Yes", "cancelling").intent).toBe(
        "CONFIRM_CANCEL",
      );
    });

    it('should detect "please cancel" in the cancelling phase', () => {
      expect(
        service.detectIntent("Yes, please cancel", "cancelling").intent,
      ).toBe("CONFIRM_CANCEL");
    });

    it('should detect "go ahead" in the cancelling_warned phase', () => {
      expect(service.detectIntent("Go ahead", "cancelling_warned").intent).toBe(
        "CONFIRM_CANCEL",
      );
    });

    it('should detect "sure" in the cancelling_warned phase', () => {
      expect(
        service.detectIntent("Sure, cancel it", "cancelling_warned").intent,
      ).toBe("CONFIRM_CANCEL");
    });

    it("should NOT detect CONFIRM_CANCEL in the booked phase", () => {
      expect(service.detectIntent("yes", "booked").intent).toBe("UNKNOWN");
    });
  });

  describe("DECLINE_CANCEL", () => {
    it('should detect "no" in the cancelling phase', () => {
      expect(service.detectIntent("No, keep it", "cancelling").intent).toBe(
        "DECLINE_CANCEL",
      );
    });

    it('should detect "changed my mind" in the cancelling_warned phase', () => {
      expect(
        service.detectIntent("I've changed my mind", "cancelling_warned")
          .intent,
      ).toBe("DECLINE_CANCEL");
    });

    it('should detect "never mind" in the cancelling phase', () => {
      expect(
        service.detectIntent("Never mind, keep it", "cancelling").intent,
      ).toBe("DECLINE_CANCEL");
    });

    it("should NOT detect DECLINE_CANCEL in the booked phase", () => {
      expect(service.detectIntent("no", "booked").intent).toBe("UNKNOWN");
    });
  });

  describe("Graceful re-entry from cancelled", () => {
    it('should detect WANT_TO_BOOK when lead in cancelled phase says "book"', () => {
      expect(
        service.detectIntent("I want to book again", "cancelled").intent,
      ).toBe("WANT_TO_BOOK");
    });

    it('should detect WANT_TO_BOOK when lead in cancelled phase says "appointment"', () => {
      expect(
        service.detectIntent("Can I make another appointment?", "cancelled")
          .intent,
      ).toBe("WANT_TO_BOOK");
    });

    it("should return UNKNOWN for non-booking message in cancelled phase", () => {
      expect(service.detectIntent("Hello", "cancelled").intent).toBe("UNKNOWN");
    });
  });
});
