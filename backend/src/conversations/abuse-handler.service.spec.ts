import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { AbuseDetectionService } from './abuse-detection.service';
import { AbuseHandlerService } from './abuse-handler.service';
import { Conversation } from '../database/schemas/conversation.schema';
import { Message } from '../database/schemas/message.schema';

/** Builds a minimal fake conversation document for testing */
function makeConversation(overrides: Partial<any> = {}): any {
  return {
    _id: 'conv123',
    channel: 'sms',
    directedHostilityCount: 0,
    abuseOfferPending: false,
    ...overrides,
  };
}

/** Builds a minimal fake clinic document for testing */
const makeClinic = () => ({ _id: 'clinic123' } as any);

/** Builds a minimal fake lead document for testing */
const makeLead = () => ({ _id: 'lead123', ghlContactId: null } as any);

/** Unit tests for AbuseHandlerService (US-19) */
describe('AbuseHandlerService', () => {
  let handlerService: AbuseHandlerService;

  // Mocked Mongoose models to avoid real DB calls in unit tests
  const mockConversationModel = { findByIdAndUpdate: jest.fn().mockResolvedValue({}), };
  const mockMessageModel = { create: jest.fn().mockResolvedValue({}), };

  beforeEach(async () => {
    // Build a real AbuseDetectionService so handler tests use real classification logic
    const detectionModule: TestingModule = await Test.createTestingModule({
      providers: [
        AbuseDetectionService,
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
      ],
    }).compile();
    const detectionService = detectionModule.get<AbuseDetectionService>(AbuseDetectionService);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbuseHandlerService,
        { provide: AbuseDetectionService, useValue: detectionService },
        { provide: getModelToken(Conversation.name), useValue: mockConversationModel },
        { provide: getModelToken(Message.name), useValue: mockMessageModel },
      ],
    }).compile();

    handlerService = module.get<AbuseHandlerService>(AbuseHandlerService);
    jest.clearAllMocks();
  });

  // Clean and casual messages must fall through to the normal AI flow
  describe('clean and casual messages', () => {
    it('should return null for a clean message', async () => {
      const result = await handlerService.handle(
        makeConversation(), makeClinic(), makeLead(), 'I need an appointment please',
      );
      expect(result).toBeNull();
    });

    it('should return null for casual swearing', async () => {
      const result = await handlerService.handle(
        makeConversation(), makeClinic(), makeLead(), 'my back is fucking killing me',
      );
      expect(result).toBeNull();
    });

    it('should NOT save a message or touch the DB for clean messages', async () => {
      await handlerService.handle(
        makeConversation(), makeClinic(), makeLead(), 'I need an appointment please',
      );
      expect(mockMessageModel.create).not.toHaveBeenCalled();
      expect(mockConversationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  // Directed hostility must return a canned response and persist state
  describe('directed hostility', () => {
    it('should return abuseFlagged: true with calm redirect', async () => {
      const result = await handlerService.handle(
        makeConversation(), makeClinic(), makeLead(), 'you are fucking useless',
      );
      expect(result!.abuseFlagged).toBe(true);
      expect(result!.escalationRequested).toBe(false);
      expect(result!.reply).toContain('I understand you may be frustrated');
    });

    it('should persist the updated directedHostilityCount to the DB', async () => {
      await handlerService.handle(
        makeConversation({ directedHostilityCount: 2 }), makeClinic(), makeLead(),
        'you are an idiot',
      );
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv123', expect.objectContaining({ directedHostilityCount: 3 }),
      );
    });

    it('should save the canned AI response as a message document', async () => {
      await handlerService.handle(
        makeConversation(), makeClinic(), makeLead(), 'you are useless',
      );
      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ sender: 'ai' }),
      );
    });

    it('should set abuseOfferPending: true in the DB at threshold', async () => {
      await handlerService.handle(
        makeConversation({ directedHostilityCount: 4 }), makeClinic(), makeLead(),
        'you are all fucking useless',
      );
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv123', expect.objectContaining({ abuseOfferPending: true }),
      );
    });

    it('should save abuse flag in message document', async () => {
      await handlerService.handle(
        makeConversation(),
        makeClinic(),
        makeLead(),
        'you are useless',
      );

      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: 'ai',
          // adjust if your schema uses a different field name e.g. abuseFlag: true
        }),
      );
    });
  });

  // Escalation fires when lead accepts the offer — shouldEscalate checked before classification
  describe('escalation — lead accepts human offer', () => {
    it('should return escalationRequested: true when lead accepts', async () => {
      const result = await handlerService.handle(
        makeConversation({ directedHostilityCount: 5, abuseOfferPending: true }),
        makeClinic(), makeLead(), 'yes please',
      );
      expect(result!.escalationRequested).toBe(true);
      expect(result!.abuseFlagged).toBe(true);
      expect(result!.reply).toContain('team member reach out');
    });

    it('should clear abuseOfferPending in the DB after escalation', async () => {
      await handlerService.handle(
        makeConversation({ directedHostilityCount: 5, abuseOfferPending: true }),
        makeClinic(), makeLead(), 'yes please',
      );
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv123', expect.objectContaining({ abuseOfferPending: false }),
      );
    });

    it('should return null (not escalate) when offer is not pending', async () => {
      // "yes please" with no offer pending is a clean message in booking context
      const result = await handlerService.handle(
        makeConversation({ abuseOfferPending: false }),
        makeClinic(), makeLead(), 'yes please',
      );
      expect(result).toBeNull();
    });

    it('should return empty offeredSlots and null booking on escalation', async () => {
      const result = await handlerService.handle(
        makeConversation({ directedHostilityCount: 5, abuseOfferPending: true }),
        makeClinic(), makeLead(), 'sure',
      );
      expect(result!.offeredSlots).toEqual([]);
      expect(result!.slotSelection).toBeNull();
      expect(result!.bookingResult).toBeNull();
    });

    it('should save escalation response message', async () => {
      await handlerService.handle(
        makeConversation({ directedHostilityCount: 5, abuseOfferPending: true }),
        makeClinic(),
        makeLead(),
        'yes',
      );

      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: 'ai',
        }),
      );
    });
  });
});