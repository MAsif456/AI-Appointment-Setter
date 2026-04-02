/**
 * Unit tests for OrchestratorService.generateResponse().
 *
 * Covers all intent branches:
 *   - PROVIDE_POSTCODE: in-area vs out-of-area prompt, Groq success/failure, British English, 160-char limit
 *   - WANT_TO_BOOK: prompt content, Groq success/failure
 *   - UNKNOWN: multi-turn history passthrough, system prompt content, Groq success/failure
 *   - British English enforcement across all intent types
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  OrchestratorService,
  OrchestratorContext,
  IntentResult,
} from './orchestrator.service';
import { GreetingService } from '../ai/greeting.service';
import { GroqService } from '../ai/groq.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { CancellationService } from '../cancellation/cancellation.service';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { PostcodeValidationService } from './postcode-validation.service';
import { PatientHistoryService } from '../patient-history/patient-history.service';
import { INVALID_POSTCODE_RESPONSE } from './orchestrator.types';
import { SecurityPipelineService } from '../security/security-pipeline.service';

const mockSecurityPipeline = {
  processInbound: jest.fn().mockImplementation((msg: string) =>
    Promise.resolve({ allowed: true, sanitisedMessage: msg, threatScore: 0, flags: [] }),
  ),
  validateOutput: jest.fn().mockReturnValue({ safe: true, flags: [] }),
};

const mockGreetingService = { generateGreeting: jest.fn() };
const mockGroqService = { generateResponse: jest.fn(), generateChatResponse: jest.fn() };
const mockCancellationService = { checkAppointmentExists: jest.fn(), buildConfirmationPrompt: jest.fn(), evaluatePolicy: jest.fn(), executeCancellation: jest.fn(), isAwaitingReason: jest.fn(), requestReason: jest.fn(), storeReason: jest.fn() };
const mockConversationsService = { findByGhlContactId: jest.fn(), createForNewLead: jest.fn(), updatePhase: jest.fn() };
const mockMessagesService = { addMessage: jest.fn(), getByConversation: jest.fn() };
const mockGhlApiService = { sendMessageWithRetry: jest.fn(), getConversation: jest.fn(), createConversation: jest.fn() };

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

describe('OrchestratorService — generateResponse', () => {
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
        PostcodeValidationService,
        { provide: SecurityPipelineService, useValue: mockSecurityPipeline },
        { provide: PatientHistoryService, useValue: { findReturningPatient: jest.fn().mockResolvedValue(null), persistHistory: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('PROVIDE_POSTCODE intent', () => {
    it('should return null when Groq fails', async () => {
      mockGroqService.generateResponse.mockResolvedValue(null);
      const result = await service.generateResponse(
        { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } },
        baseContext,
        baseClinicConfig,
      );
      expect(result).toBeNull();
    });

    it('should return the AI response when Groq succeeds', async () => {
      mockGroqService.generateResponse.mockResolvedValue('Great, you are in our area!');
      const result = await service.generateResponse(
        { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } },
        baseContext,
        baseClinicConfig,
      );
      expect(result).toBe('Great, you are in our area!');
    });

    it('should include "British English" in the prompt', async () => {
      mockGroqService.generateResponse.mockResolvedValue('Response');
      await service.generateResponse(
        { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } },
        baseContext,
        baseClinicConfig,
      );
      expect(mockGroqService.generateResponse.mock.calls[0][0] as string).toContain('British English');
    });

    it('should include the 160-character limit in the prompt', async () => {
      mockGroqService.generateResponse.mockResolvedValue('Response');
      await service.generateResponse(
        { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } },
        baseContext,
        baseClinicConfig,
      );
      expect(mockGroqService.generateResponse.mock.calls[0][0] as string).toContain('160');
    });

    it('should include "within our service area" in the prompt for an in-area postcode (CF)', async () => {
      mockGroqService.generateResponse.mockResolvedValue('You are covered!');
      await service.generateResponse(
        { intent: 'PROVIDE_POSTCODE', data: { postcode: 'CF10 1AA' } },
        baseContext,
        baseClinicConfig,
      );
      expect(mockGroqService.generateResponse.mock.calls[0][0] as string).toContain('within our service area');
    });

    it('should include "outside our service area" in the prompt for an out-of-area postcode', async () => {
      mockGroqService.generateResponse.mockResolvedValue('Sorry, not in area.');
      await service.generateResponse(
        { intent: 'PROVIDE_POSTCODE', data: { postcode: 'SA1 1AA' } },
        baseContext,
        baseClinicConfig,
      );
      expect(mockGroqService.generateResponse.mock.calls[0][0] as string).toContain('outside our service area');
    });

    it('should accept any postcode as in-area when serviceAreas is empty', async () => {
      mockGroqService.generateResponse.mockResolvedValue('You are covered!');
      await service.generateResponse(
        { intent: 'PROVIDE_POSTCODE', data: { postcode: 'SA1 1AA' } },
        baseContext,
        { ...baseClinicConfig, serviceAreas: [] },
      );
      expect(mockGroqService.generateResponse.mock.calls[0][0] as string).toContain('within our service area');
    });
  });

  describe('WANT_TO_BOOK intent', () => {
    it('should return null when Groq fails', async () => {
      mockGroqService.generateResponse.mockResolvedValue(null);
      const result = await service.generateResponse({ intent: 'WANT_TO_BOOK' }, baseContext, baseClinicConfig);
      expect(result).toBeNull();
    });

    it('should return the AI response when Groq succeeds', async () => {
      mockGroqService.generateResponse.mockResolvedValue('Brilliant, let me find you a slot!');
      const result = await service.generateResponse({ intent: 'WANT_TO_BOOK' }, baseContext, baseClinicConfig);
      expect(result).toBe('Brilliant, let me find you a slot!');
    });

    it('should include "British English" in the prompt', async () => {
      mockGroqService.generateResponse.mockResolvedValue('Response');
      await service.generateResponse({ intent: 'WANT_TO_BOOK' }, baseContext, baseClinicConfig);
      expect(mockGroqService.generateResponse.mock.calls[0][0] as string).toContain('British English');
    });

    it('should include the 160-character limit in the prompt', async () => {
      mockGroqService.generateResponse.mockResolvedValue('Response');
      await service.generateResponse({ intent: 'WANT_TO_BOOK' }, baseContext, baseClinicConfig);
      expect(mockGroqService.generateResponse.mock.calls[0][0] as string).toContain('160');
    });
  });

  describe('UNKNOWN intent', () => {
    it('should return null when Groq fails', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue(null);
      const result = await service.generateResponse({ intent: 'UNKNOWN' }, baseContext, baseClinicConfig);
      expect(result).toBeNull();
    });

    it('should return the AI response when Groq succeeds', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue('I can help with that.');
      const result = await service.generateResponse({ intent: 'UNKNOWN' }, baseContext, baseClinicConfig);
      expect(result).toBe('I can help with that.');
    });

    it('should include "British English" in the system prompt', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue('Response');
      await service.generateResponse({ intent: 'UNKNOWN' }, baseContext, baseClinicConfig);
      const messages = mockGroqService.generateChatResponse.mock.calls[0][0] as Array<{ role: string; content: string }>;
      expect(messages.find((m) => m.role === 'system')?.content).toContain('British English');
    });

    it('should include the 160-character limit in the system prompt', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue('Response');
      await service.generateResponse({ intent: 'UNKNOWN' }, baseContext, baseClinicConfig);
      const messages = mockGroqService.generateChatResponse.mock.calls[0][0] as Array<{ role: string; content: string }>;
      expect(messages.find((m) => m.role === 'system')?.content).toContain('160');
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
      await service.generateResponse({ intent: 'UNKNOWN' }, contextWithHistory, baseClinicConfig);
      const messages = mockGroqService.generateChatResponse.mock.calls[0][0] as Array<{ role: string; content: string }>;
      expect(messages).toHaveLength(4); // system + 2 history + sandwich defense system
      expect(messages[1].content).toBe('Hi, how can I help?');
      expect(messages[2].content).toContain('I have back pain.'); // wrapped in <user_message> tags
    });

    it('should send system prompt plus sandwich defense when there is no conversation history', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue('Response');
      await service.generateResponse({ intent: 'UNKNOWN' }, baseContext, baseClinicConfig);
      const messages = mockGroqService.generateChatResponse.mock.calls[0][0] as Array<{ role: string; content: string }>;
      expect(messages).toHaveLength(2); // system prompt + sandwich defense
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('system');
      expect(messages[1].content).toContain('Stay in character');
    });
  });

  describe('INVALID_POSTCODE_FORMAT intent', () => {
    it('should return the static invalid postcode response without calling Groq', async () => {
      const result = await service.generateResponse({ intent: 'INVALID_POSTCODE_FORMAT' }, baseContext, baseClinicConfig);
      expect(result).toBe(INVALID_POSTCODE_RESPONSE);
      expect(mockGroqService.generateResponse).not.toHaveBeenCalled();
      expect(mockGroqService.generateChatResponse).not.toHaveBeenCalled();
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
      expect((mockGroqService.generateResponse.mock.calls[0][0] as string).toLowerCase()).toContain('british english');
    });

    it('should include British English instruction for WANT_TO_BOOK prompt', async () => {
      mockGroqService.generateResponse.mockResolvedValue('ok');
      await service.generateResponse({ intent: 'WANT_TO_BOOK' }, baseContext, baseClinicConfig);
      expect((mockGroqService.generateResponse.mock.calls[0][0] as string).toLowerCase()).toContain('british english');
    });

    it('should include British English instruction for UNKNOWN system prompt', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue('ok');
      await service.generateResponse({ intent: 'UNKNOWN' }, baseContext, baseClinicConfig);
      const msgs = mockGroqService.generateChatResponse.mock.calls[0][0] as Array<{ role: string; content: string }>;
      expect(msgs[0].content.toLowerCase()).toContain('british english');
    });
  });
});
