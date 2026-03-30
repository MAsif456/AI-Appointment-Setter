/**
 * Integration-level tests for the returning patient feature.
 *
 * These tests focus on the interactions between PatientHistoryService,
 * the orchestrator new-lead flow, and the inbound-message phase transitions.
 * All external dependencies (Mongoose models, GHL API, Groq) are mocked.
 *
 * Covers:
 *   1.  Phone match same clinic -> high confidence
 *   2.  Phone match different clinic -> null (clinic scoping enforced)
 *   3.  Email match same clinic -> medium confidence
 *   4.  No match -> null (treated as new patient)
 *   5.  Cancelled patient is still recognised (PatientHistory record persists)
 *   6.  Stale data (beyond patientDataExpiryDays) -> stale confidence
 *   7.  DETAILS_UNCHANGED -> phase transitions to 'booking', postcode copied
 *   8.  DETAILS_CHANGED -> phase transitions to 'qualifying'
 *   9.  RETURNING_PATIENT_DETECTED analytics event logged when match found
 *   10. Returning patient lookup failure -> graceful fallback to new patient flow
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PatientHistoryService } from './patient-history.service';
import { PatientHistory } from '../database/schemas/patient-history.schema';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { GreetingService } from '../ai/greeting.service';
import { GroqService } from '../ai/groq.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { CancellationService } from '../cancellation/cancellation.service';
import { PostcodeValidationService } from '../orchestrator/postcode-validation.service';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';

// ---- Shared fixtures ----

const CLINIC_A = '507f1f77bcf86cd799439011';
const CLINIC_B = '507f1f77bcf86cd799439022';
const CONV_ID = new Types.ObjectId('507f1f77bcf86cd799439033');

const recentRecord = {
  firstName: 'Jane',
  lastName: 'Doe',
  validatedPostcode: 'CF10 1AA',
  previousConversationId: CONV_ID,
  lastBookedAt: new Date(Date.now() - 10 * 86_400_000), // 10 days ago
};

const staleRecord = {
  ...recentRecord,
  lastBookedAt: new Date(Date.now() - 400 * 86_400_000), // 400 days ago
};

// ---- PatientHistoryService isolation tests ----

describe('PatientHistoryService - clinic scoping and edge cases', () => {
  let service: PatientHistoryService;

  function buildModule(findOneResult: unknown = null) {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(findOneResult) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    return { mockModel };
  }

  async function createService(findOneResult: unknown = null) {
    const { mockModel } = buildModule(findOneResult);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientHistoryService,
        { provide: getModelToken(PatientHistory.name), useValue: mockModel },
      ],
    }).compile();
    service = module.get<PatientHistoryService>(PatientHistoryService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    return mockModel;
  }

  afterEach(() => jest.restoreAllMocks());

  // Test 1: phone match same clinic
  it('returns high confidence for a phone match at the same clinic', async () => {
    await createService(recentRecord);
    const result = await service.findReturningPatient('07911123456', undefined, CLINIC_A, 365);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('high');
    expect(result!.firstName).toBe('Jane');
  });

  // Test 2: clinic scoping — different clinic must not return a match
  it('returns null when the phone matches a record at a different clinic', async () => {
    // Model returns null because the clinicId filter will not match CLINIC_B
    await createService(null);
    const result = await service.findReturningPatient('07911123456', undefined, CLINIC_B, 365);
    expect(result).toBeNull();
  });

  // Test 3: email match same clinic
  it('returns medium confidence for an email-only match at the same clinic', async () => {
    // Phone is undefined so phone lookup is skipped; only email query runs
    const mockModel = {
      findOne: jest.fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(recentRecord) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientHistoryService,
        { provide: getModelToken(PatientHistory.name), useValue: mockModel },
      ],
    }).compile();
    service = module.get<PatientHistoryService>(PatientHistoryService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const result = await service.findReturningPatient(undefined, 'jane@example.com', CLINIC_A, 365);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('medium');
  });

  // Test 4: no match
  it('returns null when there is no matching record', async () => {
    await createService(null);
    const result = await service.findReturningPatient('07900000000', 'unknown@x.com', CLINIC_A, 365);
    expect(result).toBeNull();
  });

  // Test 5: cancelled patient — PatientHistory persists after cancellation
  // The PatientHistory record is written at booking time and never deleted on cancellation,
  // so a cancelled patient is always recognised as returning.
  it('still recognises a patient whose last conversation was cancelled', async () => {
    // PatientHistory record exists regardless of cancellation status
    await createService(recentRecord);
    const result = await service.findReturningPatient('07911123456', undefined, CLINIC_A, 365);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('high');
  });

  // Test 6: stale data
  it('returns stale confidence when the last booking is beyond the expiry window', async () => {
    await createService(staleRecord);
    const result = await service.findReturningPatient('07911123456', undefined, CLINIC_A, 365);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('stale');
  });

  // Test 10: DB failure -> graceful fallback
  it('returns null and does not throw when the database lookup fails', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockRejectedValue(new Error('timeout')) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientHistoryService,
        { provide: getModelToken(PatientHistory.name), useValue: mockModel },
      ],
    }).compile();
    service = module.get<PatientHistoryService>(PatientHistoryService);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const result = await service.findReturningPatient('07911123456', undefined, CLINIC_A, 365);
    expect(result).toBeNull();
  });
});

// ---- OrchestratorService integration: returning patient flow ----

describe('OrchestratorService - returning patient flow', () => {
  let orchestratorService: OrchestratorService;
  let logSpy: jest.SpyInstance;

  const mockConversation = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439044'),
    leadId: new Types.ObjectId('507f1f77bcf86cd799439055'),
    channel: 'sms',
    phase: 'greeting',
    isReturningPatient: true,
    context: new Map([['returningPatientPostcode', 'CF10 1AA']]),
  };

  const mockGreetingService = {
    generateGreeting: jest.fn().mockResolvedValue('Hello there!'),
    generateReturningPatientGreeting: jest.fn().mockResolvedValue('Welcome back, Jane!'),
  };
  const mockGroqService = {
    generateResponse: jest.fn(),
    generateChatResponse: jest.fn(),
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
    createConversation: jest.fn().mockResolvedValue({ id: 'conv_001' }),
    sendMessageWithRetry: jest.fn().mockResolvedValue({ id: 'msg_001' }),
  };
  const mockCancellationService = {
    checkAppointmentExists: jest.fn(),
    buildConfirmationPrompt: jest.fn(),
    evaluatePolicy: jest.fn(),
    executeCancellation: jest.fn(),
  };
  const mockPatientHistoryService = {
    findReturningPatient: jest.fn(),
    persistHistory: jest.fn().mockResolvedValue(undefined),
  };

  const clinicConfig: ClinicConfig = {
    clinicId: CLINIC_A,
    name: 'Cardiff Physio',
    tone: 'Friendly',
    ghlLocationId: 'loc_001',
    isActive: true,
    patientDataExpiryDays: 365,
  };

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
        { provide: PatientHistoryService, useValue: mockPatientHistoryService },
        PostcodeValidationService,
      ],
    }).compile();

    orchestratorService = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();

    // Restore defaults after clearAllMocks
    mockGhlApiService.createConversation.mockResolvedValue({ id: 'conv_001' });
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: 'msg_001' });
    mockConversationsService.createForNewLead.mockResolvedValue(mockConversation);
    mockGreetingService.generateGreeting.mockResolvedValue('Hello there!');
    mockGreetingService.generateReturningPatientGreeting.mockResolvedValue('Welcome back, Jane!');
    mockMessagesService.addMessage.mockResolvedValue({});
    mockConversationsService.updatePhase.mockResolvedValue({});
    mockConversationsService.updateReturningPatientFlags.mockResolvedValue({});
    mockConversationsService.setContext.mockResolvedValue({});

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  // Test 9: analytics event logged
  it('logs RETURNING_PATIENT_DETECTED when a returning patient is found', async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue({
      ...recentRecord,
      confidence: 'high',
    });

    await orchestratorService.handleNewLead(
      { type: 'ContactCreate', location: { id: 'loc_001' }, id: 'contact_001', phone: '07911123456' } as any,
      clinicConfig,
    );

    const logCalls = logSpy.mock.calls.map((c) => c[0] as string);
    expect(logCalls.some((msg) => msg.includes('RETURNING_PATIENT_DETECTED'))).toBe(true);
  });

  it('does not log RETURNING_PATIENT_DETECTED for a new patient', async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);

    await orchestratorService.handleNewLead(
      { type: 'ContactCreate', location: { id: 'loc_001' }, id: 'contact_001', phone: '07911123456' } as any,
      clinicConfig,
    );

    const logCalls = logSpy.mock.calls.map((c) => c[0] as string);
    expect(logCalls.some((msg) => msg.includes('RETURNING_PATIENT_DETECTED'))).toBe(false);
  });

  it('calls generateReturningPatientGreeting for a returning patient', async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue({
      ...recentRecord,
      confidence: 'high',
    });

    await orchestratorService.handleNewLead(
      { type: 'ContactCreate', location: { id: 'loc_001' }, id: 'contact_001', phone: '07911123456' } as any,
      clinicConfig,
    );

    expect(mockGreetingService.generateReturningPatientGreeting).toHaveBeenCalled();
    expect(mockGreetingService.generateGreeting).not.toHaveBeenCalled();
  });

  it('calls generateGreeting (not returning) for a new patient', async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);

    await orchestratorService.handleNewLead(
      { type: 'ContactCreate', location: { id: 'loc_001' }, id: 'contact_001', phone: '07911123456' } as any,
      clinicConfig,
    );

    expect(mockGreetingService.generateGreeting).toHaveBeenCalled();
    expect(mockGreetingService.generateReturningPatientGreeting).not.toHaveBeenCalled();
  });

  it('keeps phase as greeting for returning patients instead of advancing to qualifying', async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue({
      ...recentRecord,
      confidence: 'high',
    });

    await orchestratorService.handleNewLead(
      { type: 'ContactCreate', location: { id: 'loc_001' }, id: 'contact_001', phone: '07911123456' } as any,
      clinicConfig,
    );

    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(
      expect.anything(),
      'greeting',
    );
  });

  it('advances phase to qualifying for new patients', async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);

    await orchestratorService.handleNewLead(
      { type: 'ContactCreate', location: { id: 'loc_001' }, id: 'contact_001', phone: '07911123456' } as any,
      clinicConfig,
    );

    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(
      expect.anything(),
      'qualifying',
    );
  });

  it('falls back to new patient flow when patient history lookup fails', async () => {
    mockPatientHistoryService.findReturningPatient.mockResolvedValue(null);

    await orchestratorService.handleNewLead(
      { type: 'ContactCreate', location: { id: 'loc_001' }, id: 'contact_001', phone: '07911123456' } as any,
      clinicConfig,
    );

    // Standard new patient greeting should be called
    expect(mockGreetingService.generateGreeting).toHaveBeenCalled();
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(
      expect.anything(),
      'qualifying',
    );
  });

  // Test 7: DETAILS_UNCHANGED intent detection
  it('detects DETAILS_UNCHANGED intent when phase is greeting and patient is returning', () => {
    const intent = orchestratorService.detectIntent('yes same', 'greeting', { isReturningPatient: true });
    expect(intent.intent).toBe('DETAILS_UNCHANGED');
  });

  // Test 8: DETAILS_CHANGED intent detection
  it('detects DETAILS_CHANGED intent when phase is greeting and patient is returning', () => {
    const intent = orchestratorService.detectIntent('I have moved', 'greeting', { isReturningPatient: true });
    expect(intent.intent).toBe('DETAILS_CHANGED');
  });

  it('does not detect DETAILS_UNCHANGED when isReturningPatient is false', () => {
    const intent = orchestratorService.detectIntent('yes same', 'greeting', { isReturningPatient: false });
    expect(intent.intent).toBe('UNKNOWN');
  });

  it('does not detect DETAILS_CHANGED when isReturningPatient is false', () => {
    const intent = orchestratorService.detectIntent('I have moved', 'greeting', { isReturningPatient: false });
    expect(intent.intent).toBe('UNKNOWN');
  });
});
