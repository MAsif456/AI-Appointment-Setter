/**
 * Unit tests for OrchestratorService.detectIntent().
 *
 * Covers phase-gated intent detection:
 *   - PROVIDE_POSTCODE: various postcode formats, normalisation, phase-gating
 *   - WANT_TO_BOOK: keyword matching, case-insensitivity, phase-gating
 *   - UNKNOWN: fallback for unrecognised messages
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { GreetingService } from '../ai/greeting.service';
import { GroqService } from '../ai/groq.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { PostcodeValidationService } from './postcode-validation.service';

const mockGreetingService = { generateGreeting: jest.fn() };
const mockGroqService = { generateResponse: jest.fn(), generateChatResponse: jest.fn() };
const mockConversationsService = { findByGhlContactId: jest.fn(), createForNewLead: jest.fn(), updatePhase: jest.fn() };
const mockMessagesService = { addMessage: jest.fn(), getByConversation: jest.fn() };
const mockGhlApiService = { sendMessageWithRetry: jest.fn(), getConversation: jest.fn(), createConversation: jest.fn() };

describe('OrchestratorService — detectIntent', () => {
  let service: OrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: GreetingService, useValue: mockGreetingService },
        { provide: GroqService, useValue: mockGroqService },
        { provide: ConversationsService, useValue: mockConversationsService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: GhlApiService, useValue: mockGhlApiService },
        PostcodeValidationService,
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('PROVIDE_POSTCODE', () => {
    it('should detect a standard-format postcode (CF10 1AA) in the qualifying phase', () => {
      expect(service.detectIntent('My postcode is CF10 1AA', 'qualifying').intent).toBe('PROVIDE_POSTCODE');
    });

    it('should normalise a spaceless lowercase postcode (cf101aa) to uppercase with a space', () => {
      const result = service.detectIntent('cf101aa', 'qualifying');
      expect(result.intent).toBe('PROVIDE_POSTCODE');
      if (result.intent === 'PROVIDE_POSTCODE') {
        expect(result.data.postcode).toBe('CF10 1AA');
      }
    });

    it('should detect a postcode embedded in a longer sentence', () => {
      expect(
        service.detectIntent('My postcode is CF10 1AA, let me know if that works', 'qualifying').intent,
      ).toBe('PROVIDE_POSTCODE');
    });

    it('should normalise a postcode that already has correct spacing (NP20 4NT)', () => {
      const result = service.detectIntent('NP20 4NT', 'qualifying');
      expect(result.intent).toBe('PROVIDE_POSTCODE');
      if (result.intent === 'PROVIDE_POSTCODE') {
        expect(result.data.postcode).toBe('NP20 4NT');
      }
    });

    it('should normalise a lowercase postcode (np204nt) to uppercase with a space', () => {
      const result = service.detectIntent('np204nt', 'qualifying');
      expect(result.intent).toBe('PROVIDE_POSTCODE');
      if (result.intent === 'PROVIDE_POSTCODE') {
        expect(result.data.postcode).toBe('NP20 4NT');
      }
    });

    it('should NOT detect a postcode when the phase is greeting', () => {
      expect(service.detectIntent('CF10 1AA', 'greeting').intent).toBe('UNKNOWN');
    });

    it('should NOT detect a postcode when the phase is qualified', () => {
      expect(service.detectIntent('CF10 1AA', 'qualified').intent).toBe('UNKNOWN');
    });

    it('should NOT detect a postcode when the phase is booking', () => {
      expect(service.detectIntent('CF10 1AA', 'booking').intent).toBe('UNKNOWN');
    });
  });

  describe('WANT_TO_BOOK', () => {
    it('should detect the keyword "book" in the qualified phase', () => {
      expect(service.detectIntent('I would like to book', 'qualified').intent).toBe('WANT_TO_BOOK');
    });

    it('should detect the keyword "appointment" in the qualified phase', () => {
      expect(service.detectIntent('Can I make an appointment?', 'qualified').intent).toBe('WANT_TO_BOOK');
    });

    it('should detect the keyword "schedule" in the qualified phase', () => {
      expect(service.detectIntent('Can you schedule me in?', 'qualified').intent).toBe('WANT_TO_BOOK');
    });

    it('should detect the phrase "sign me up" in the qualified phase', () => {
      expect(service.detectIntent('Yes, sign me up please', 'qualified').intent).toBe('WANT_TO_BOOK');
    });

    it('should detect the phrase "yes please" in the qualified phase', () => {
      expect(service.detectIntent('yes please', 'qualified').intent).toBe('WANT_TO_BOOK');
    });

    it('should be case-insensitive for booking keywords', () => {
      expect(service.detectIntent('I want to BOOK an APPOINTMENT', 'qualified').intent).toBe('WANT_TO_BOOK');
    });

    it('should NOT detect booking intent when the phase is qualifying', () => {
      expect(service.detectIntent('I want to book', 'qualifying').intent).toBe('UNKNOWN');
    });

    it('should NOT detect booking intent when the phase is greeting', () => {
      expect(service.detectIntent('book me in', 'greeting').intent).toBe('UNKNOWN');
    });
  });

  describe('INVALID_POSTCODE_FORMAT', () => {
    it('should return INVALID_POSTCODE_FORMAT for a numeric-only string (12345) in qualifying phase', () => {
      expect(service.detectIntent('12345', 'qualifying').intent).toBe('INVALID_POSTCODE_FORMAT');
    });

    it('should return INVALID_POSTCODE_FORMAT for a short alphanumeric string with digit (AB12) in qualifying phase', () => {
      expect(service.detectIntent('AB12', 'qualifying').intent).toBe('INVALID_POSTCODE_FORMAT');
    });

    it('should return INVALID_POSTCODE_FORMAT for a random letter string with no digits (ghthhdh)', () => {
      expect(service.detectIntent('ghthhdh', 'qualifying').intent).toBe('INVALID_POSTCODE_FORMAT');
    });

    it('should return INVALID_POSTCODE_FORMAT for a mixed random string (c738487)', () => {
      expect(service.detectIntent('c738487', 'qualifying').intent).toBe('INVALID_POSTCODE_FORMAT');
    });

    it('should return INVALID_POSTCODE_FORMAT for a postcode with a too-long inward code (CF10 1AAA)', () => {
      expect(service.detectIntent('CF10 1AAA', 'qualifying').intent).toBe('INVALID_POSTCODE_FORMAT');
    });

    it('should return UNKNOWN for an invalid-format attempt outside the qualifying phase', () => {
      expect(service.detectIntent('12345', 'greeting').intent).toBe('UNKNOWN');
    });

    it('should return UNKNOWN for a very short input (hi) that is below the minimum length', () => {
      expect(service.detectIntent('hi', 'qualifying').intent).toBe('UNKNOWN');
    });
  });

  describe('UNKNOWN', () => {
    it('should return UNKNOWN for a full sentence with no matching content', () => {
      expect(service.detectIntent('I am not sure what I need', 'qualifying').intent).toBe('UNKNOWN');
    });

    it('should return UNKNOWN for an empty message', () => {
      expect(service.detectIntent('', 'qualifying').intent).toBe('UNKNOWN');
    });

    it('should return UNKNOWN when the message is a general question', () => {
      expect(service.detectIntent('How much does a session cost?', 'greeting').intent).toBe('UNKNOWN');
    });

    it('should return UNKNOWN when the message contains spaces and punctuation (Hi there!)', () => {
      expect(service.detectIntent('Hi there!', 'qualifying').intent).toBe('UNKNOWN');
    });
  });
});
