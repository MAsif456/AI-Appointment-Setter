/**
 * Unit tests for OrchestratorService.
 *
 * Tests cover the parts that can be fully verified without Suli's conversation
 * context or GHL messaging services (US-08):
 *   - detectIntent: postcode patterns, booking keywords, phase-gating, UNKNOWN fallback
 *   - createMessage: correct structure (content, role, timestamp)
 *   - generateResponse: British English instructions, 160-char limit, null on AI failure,
 *                       in-area vs out-of-area postcode prompting, history passthrough
 *   - FALLBACK_MESSAGE: correct string value
 *
 * GroqService and GreetingService are mocked so no network calls are made.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  OrchestratorService,
  OrchestratorContext,
  IntentResult,
  FALLBACK_MESSAGE,
} from './orchestrator.service';
import { GreetingService } from '../ai/greeting.service';
import { GroqService } from '../ai/groq.service';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';

const mockGreetingService = {
  generateGreeting: jest.fn(),
};

const mockGroqService = {
  generateResponse: jest.fn(),
  generateChatResponse: jest.fn(),
};

/** Reusable active clinic config covering CF and NP postcode areas. */
const baseClinicConfig: ClinicConfig = {
  clinicId: 'clinic_001',
  name: 'Cardiff Physiotherapy Centre',
  tone: 'Friendly',
  serviceAreas: ['CF', 'NP'],
  ghlLocationId: 'loc_cardiff_001',
  isActive: true,
};

/** Reusable minimal conversation context in the qualifying phase. */
const baseContext: OrchestratorContext = {
  clinicId: 'clinic_001',
  phase: 'qualifying',
  messages: [],
  patientInfo: { firstName: 'Sarah', issue: 'Back pain' },
};

describe('OrchestratorService', () => {
  let service: OrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: GreetingService, useValue: mockGreetingService },
        { provide: GroqService, useValue: mockGroqService },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();

    /** Silence logger output to keep the test console clean. */
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── FALLBACK_MESSAGE ──────────────────────────────────────────────────────

  describe('FALLBACK_MESSAGE', () => {
    it('should be the correct fallback string', () => {
      expect(FALLBACK_MESSAGE).toBe(
        "Thanks for your message! Someone from the clinic will be in touch shortly.",
      );
    });
  });

  // ─── createMessage ─────────────────────────────────────────────────────────

  describe('createMessage', () => {
    it('should return an object with the correct content', () => {
      const msg = service.createMessage('Hello there', 'user');
      expect(msg.content).toBe('Hello there');
    });

    it('should return the user role correctly', () => {
      const msg = service.createMessage('Hello', 'user');
      expect(msg.role).toBe('user');
    });

    it('should return the assistant role correctly', () => {
      const msg = service.createMessage('How can I help?', 'assistant');
      expect(msg.role).toBe('assistant');
    });

    it('should include a timestamp that is a Date instance', () => {
      const msg = service.createMessage('test', 'user');
      expect(msg.timestamp).toBeInstanceOf(Date);
    });

    it('should set the timestamp to approximately now', () => {
      const before = new Date();
      const msg = service.createMessage('test', 'assistant');
      const after = new Date();
      expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ─── detectIntent ──────────────────────────────────────────────────────────

  describe('detectIntent', () => {
    describe('PROVIDE_POSTCODE', () => {
      it('should detect a standard-format postcode (CF10 1AA) in the qualifying phase', () => {
        const result = service.detectIntent('My postcode is CF10 1AA', 'qualifying');
        expect(result.intent).toBe('PROVIDE_POSTCODE');
      });

      it('should normalise a spaceless lowercase postcode (cf101aa) to uppercase with a space', () => {
        const result = service.detectIntent('cf101aa', 'qualifying');
        expect(result.intent).toBe('PROVIDE_POSTCODE');
        if (result.intent === 'PROVIDE_POSTCODE') {
          expect(result.data.postcode).toBe('CF10 1AA');
        }
      });

      it('should detect a postcode embedded in a longer sentence', () => {
        const result = service.detectIntent(
          'My postcode is CF10 1AA, let me know if that works',
          'qualifying',
        );
        expect(result.intent).toBe('PROVIDE_POSTCODE');
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
        const result = service.detectIntent('CF10 1AA', 'greeting');
        expect(result.intent).toBe('UNKNOWN');
      });

      it('should NOT detect a postcode when the phase is qualified', () => {
        const result = service.detectIntent('CF10 1AA', 'qualified');
        expect(result.intent).toBe('UNKNOWN');
      });

      it('should NOT detect a postcode when the phase is booking', () => {
        const result = service.detectIntent('CF10 1AA', 'booking');
        expect(result.intent).toBe('UNKNOWN');
      });
    });

    describe('WANT_TO_BOOK', () => {
      it('should detect the keyword "book" in the qualified phase', () => {
        const result = service.detectIntent('I would like to book', 'qualified');
        expect(result.intent).toBe('WANT_TO_BOOK');
      });

      it('should detect the keyword "appointment" in the qualified phase', () => {
        const result = service.detectIntent('Can I make an appointment?', 'qualified');
        expect(result.intent).toBe('WANT_TO_BOOK');
      });

      it('should detect the keyword "schedule" in the qualified phase', () => {
        const result = service.detectIntent('Can you schedule me in?', 'qualified');
        expect(result.intent).toBe('WANT_TO_BOOK');
      });

      it('should detect the phrase "sign me up" in the qualified phase', () => {
        const result = service.detectIntent('Yes, sign me up please', 'qualified');
        expect(result.intent).toBe('WANT_TO_BOOK');
      });

      it('should detect the phrase "yes please" in the qualified phase', () => {
        const result = service.detectIntent('yes please', 'qualified');
        expect(result.intent).toBe('WANT_TO_BOOK');
      });

      it('should be case-insensitive for booking keywords', () => {
        const result = service.detectIntent('I want to BOOK an APPOINTMENT', 'qualified');
        expect(result.intent).toBe('WANT_TO_BOOK');
      });

      it('should NOT detect booking intent when the phase is qualifying', () => {
        const result = service.detectIntent('I want to book', 'qualifying');
        expect(result.intent).toBe('UNKNOWN');
      });

      it('should NOT detect booking intent when the phase is greeting', () => {
        const result = service.detectIntent('book me in', 'greeting');
        expect(result.intent).toBe('UNKNOWN');
      });
    });

    describe('UNKNOWN', () => {
      it('should return UNKNOWN for a message with no matching content', () => {
        const result = service.detectIntent('I am not sure what I need', 'qualifying');
        expect(result.intent).toBe('UNKNOWN');
      });

      it('should return UNKNOWN for an empty message', () => {
        const result = service.detectIntent('', 'qualifying');
        expect(result.intent).toBe('UNKNOWN');
      });

      it('should return UNKNOWN when the message is a general question', () => {
        const result = service.detectIntent('How much does a session cost?', 'greeting');
        expect(result.intent).toBe('UNKNOWN');
      });

      it('should return UNKNOWN when the message is a greeting with no intent', () => {
        const result = service.detectIntent('Hi there!', 'qualifying');
        expect(result.intent).toBe('UNKNOWN');
      });
    });
  });

  // ─── generateResponse ──────────────────────────────────────────────────────

  describe('generateResponse', () => {
    describe('PROVIDE_POSTCODE intent', () => {
      it('should return null when Groq fails', async () => {
        mockGroqService.generateResponse.mockResolvedValue(null);
        const intent: IntentResult = { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } };
        const result = await service.generateResponse(intent, baseContext, baseClinicConfig);
        expect(result).toBeNull();
      });

      it('should return the AI response when Groq succeeds', async () => {
        mockGroqService.generateResponse.mockResolvedValue('Great, you are in our area!');
        const intent: IntentResult = { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } };
        const result = await service.generateResponse(intent, baseContext, baseClinicConfig);
        expect(result).toBe('Great, you are in our area!');
      });

      it('should include "British English" in the prompt', async () => {
        mockGroqService.generateResponse.mockResolvedValue('Response');
        const intent: IntentResult = { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const prompt = mockGroqService.generateResponse.mock.calls[0][0] as string;
        expect(prompt).toContain('British English');
      });

      it('should include the 160-character limit in the prompt', async () => {
        mockGroqService.generateResponse.mockResolvedValue('Response');
        const intent: IntentResult = { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const prompt = mockGroqService.generateResponse.mock.calls[0][0] as string;
        expect(prompt).toContain('160');
      });

      it('should include "within our service area" in the prompt for an in-area postcode', async () => {
        mockGroqService.generateResponse.mockResolvedValue('You are covered!');
        // CF10 starts with CF, which is in serviceAreas: ['CF', 'NP']
        const intent: IntentResult = { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const prompt = mockGroqService.generateResponse.mock.calls[0][0] as string;
        expect(prompt).toContain('within our service area');
      });

      it('should include "outside our service area" in the prompt for an out-of-area postcode', async () => {
        mockGroqService.generateResponse.mockResolvedValue('Sorry, not in area.');
        // SA1 starts with SA, which is NOT in serviceAreas: ['CF', 'NP']
        const intent: IntentResult = { intent: 'PROVIDE_POSTCODE', data: { postcode: 'SA1 1AA' } };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const prompt = mockGroqService.generateResponse.mock.calls[0][0] as string;
        expect(prompt).toContain('outside our service area');
      });

      it('should accept any postcode when serviceAreas is empty', async () => {
        mockGroqService.generateResponse.mockResolvedValue('You are covered!');
        const noAreaConfig: ClinicConfig = { ...baseClinicConfig, serviceAreas: [] };
        const intent: IntentResult = { intent: 'PROVIDE_POSTCODE', data: { postcode: 'SA1 1AA' } };
        await service.generateResponse(intent, baseContext, noAreaConfig);
        const prompt = mockGroqService.generateResponse.mock.calls[0][0] as string;
        expect(prompt).toContain('within our service area');
      });
    });

    describe('WANT_TO_BOOK intent', () => {
      it('should return null when Groq fails', async () => {
        mockGroqService.generateResponse.mockResolvedValue(null);
        const intent: IntentResult = { intent: 'WANT_TO_BOOK' };
        const result = await service.generateResponse(intent, baseContext, baseClinicConfig);
        expect(result).toBeNull();
      });

      it('should return the AI response when Groq succeeds', async () => {
        mockGroqService.generateResponse.mockResolvedValue('Brilliant, let me find you a slot!');
        const intent: IntentResult = { intent: 'WANT_TO_BOOK' };
        const result = await service.generateResponse(intent, baseContext, baseClinicConfig);
        expect(result).toBe('Brilliant, let me find you a slot!');
      });

      it('should include "British English" in the prompt', async () => {
        mockGroqService.generateResponse.mockResolvedValue('Response');
        const intent: IntentResult = { intent: 'WANT_TO_BOOK' };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const prompt = mockGroqService.generateResponse.mock.calls[0][0] as string;
        expect(prompt).toContain('British English');
      });

      it('should include the 160-character limit in the prompt', async () => {
        mockGroqService.generateResponse.mockResolvedValue('Response');
        const intent: IntentResult = { intent: 'WANT_TO_BOOK' };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const prompt = mockGroqService.generateResponse.mock.calls[0][0] as string;
        expect(prompt).toContain('160');
      });
    });

    describe('UNKNOWN intent', () => {
      it('should return null when Groq fails', async () => {
        mockGroqService.generateChatResponse.mockResolvedValue(null);
        const intent: IntentResult = { intent: 'UNKNOWN' };
        const result = await service.generateResponse(intent, baseContext, baseClinicConfig);
        expect(result).toBeNull();
      });

      it('should return the AI response when Groq succeeds', async () => {
        mockGroqService.generateChatResponse.mockResolvedValue('I can help with that.');
        const intent: IntentResult = { intent: 'UNKNOWN' };
        const result = await service.generateResponse(intent, baseContext, baseClinicConfig);
        expect(result).toBe('I can help with that.');
      });

      it('should include "British English" in the system prompt', async () => {
        mockGroqService.generateChatResponse.mockResolvedValue('Response');
        const intent: IntentResult = { intent: 'UNKNOWN' };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const messages = mockGroqService.generateChatResponse.mock
          .calls[0][0] as Array<{ role: string; content: string }>;
        const systemMsg = messages.find((m) => m.role === 'system');
        expect(systemMsg?.content).toContain('British English');
      });

      it('should include the 160-character limit in the system prompt', async () => {
        mockGroqService.generateChatResponse.mockResolvedValue('Response');
        const intent: IntentResult = { intent: 'UNKNOWN' };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const messages = mockGroqService.generateChatResponse.mock
          .calls[0][0] as Array<{ role: string; content: string }>;
        const systemMsg = messages.find((m) => m.role === 'system');
        expect(systemMsg?.content).toContain('160');
      });

      it('should pass the full conversation history to Groq', async () => {
        mockGroqService.generateChatResponse.mockResolvedValue('Response');
        const contextWithHistory: OrchestratorContext = {
          ...baseContext,
          messages: [
            { content: 'Hi, how can I help?', role: 'assistant', timestamp: new Date() },
            { content: 'I have back pain.', role: 'user', timestamp: new Date() },
          ],
        };
        const intent: IntentResult = { intent: 'UNKNOWN' };
        await service.generateResponse(intent, contextWithHistory, baseClinicConfig);
        const messages = mockGroqService.generateChatResponse.mock
          .calls[0][0] as Array<{ role: string; content: string }>;
        // system + 2 history messages
        expect(messages).toHaveLength(3);
        expect(messages[1].content).toBe('Hi, how can I help?');
        expect(messages[1].role).toBe('assistant');
        expect(messages[2].content).toBe('I have back pain.');
        expect(messages[2].role).toBe('user');
      });

      it('should send only the system prompt when there is no conversation history', async () => {
        mockGroqService.generateChatResponse.mockResolvedValue('Response');
        const intent: IntentResult = { intent: 'UNKNOWN' };
        await service.generateResponse(intent, baseContext, baseClinicConfig);
        const messages = mockGroqService.generateChatResponse.mock
          .calls[0][0] as Array<{ role: string; content: string }>;
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('system');
      });
    });

    describe('British English enforcement across all intents', () => {
      it('should include British English instruction for PROVIDE_POSTCODE prompt', async () => {
        mockGroqService.generateResponse.mockResolvedValue('ok');
        await service.generateResponse(
          { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } },
          baseContext,
          baseClinicConfig,
        );
        expect(
          (mockGroqService.generateResponse.mock.calls[0][0] as string).toLowerCase(),
        ).toContain('british english');
      });

      it('should include British English instruction for WANT_TO_BOOK prompt', async () => {
        mockGroqService.generateResponse.mockResolvedValue('ok');
        await service.generateResponse(
          { intent: 'WANT_TO_BOOK' },
          baseContext,
          baseClinicConfig,
        );
        expect(
          (mockGroqService.generateResponse.mock.calls[0][0] as string).toLowerCase(),
        ).toContain('british english');
      });

      it('should include British English instruction for UNKNOWN system prompt', async () => {
        mockGroqService.generateChatResponse.mockResolvedValue('ok');
        await service.generateResponse(
          { intent: 'UNKNOWN' },
          baseContext,
          baseClinicConfig,
        );
        const msgs = mockGroqService.generateChatResponse.mock.calls[0][0] as Array<{
          role: string;
          content: string;
        }>;
        expect(msgs[0].content.toLowerCase()).toContain('british english');
      });
    });
  });
});
