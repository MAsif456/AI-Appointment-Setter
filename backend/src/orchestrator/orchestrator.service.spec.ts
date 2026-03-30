/**
 * Smoke tests for OrchestratorService — verifies the service can be instantiated
 * and exports the correct FALLBACK_MESSAGE constant.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { OrchestratorService, FALLBACK_MESSAGE } from './orchestrator.service';
import { GreetingService } from '../ai/greeting.service';
import { GroqService } from '../ai/groq.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { CancellationService } from '../cancellation/cancellation.service';
import { PostcodeValidationService } from './postcode-validation.service';
import { PatientHistoryService } from '../patient-history/patient-history.service';

const mockGreetingService = { generateGreeting: jest.fn() };
const mockGroqService = { generateResponse: jest.fn(), generateChatResponse: jest.fn() };
const mockCancellationService = { checkAppointmentExists: jest.fn(), buildConfirmationPrompt: jest.fn(), evaluatePolicy: jest.fn(), executeCancellation: jest.fn(), isAwaitingReason: jest.fn(), requestReason: jest.fn(), storeReason: jest.fn() };
const mockConversationsService = { findByGhlContactId: jest.fn(), createForNewLead: jest.fn(), updatePhase: jest.fn() };
const mockMessagesService = { addMessage: jest.fn(), getByConversation: jest.fn() };
const mockGhlApiService = { sendMessageWithRetry: jest.fn(), getConversation: jest.fn(), createConversation: jest.fn() };

describe('OrchestratorService', () => {
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('FALLBACK_MESSAGE', () => {
    it('should be the correct fallback string', () => {
      expect(FALLBACK_MESSAGE).toBe(
        "Thanks for your message! Someone from the clinic will be in touch shortly.",
      );
    });
  });

  describe('createMessage', () => {
    it('should return an object with the correct content', () => {
      expect(service.createMessage('Hello there', 'user').content).toBe('Hello there');
    });

    it('should return the user role correctly', () => {
      expect(service.createMessage('Hello', 'user').role).toBe('user');
    });

    it('should return the assistant role correctly', () => {
      expect(service.createMessage('How can I help?', 'assistant').role).toBe('assistant');
    });

    it('should include a timestamp that is a Date instance', () => {
      expect(service.createMessage('test', 'user').timestamp).toBeInstanceOf(Date);
    });

    it('should set the timestamp to approximately now', () => {
      const before = new Date();
      const msg = service.createMessage('test', 'assistant');
      const after = new Date();
      expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
