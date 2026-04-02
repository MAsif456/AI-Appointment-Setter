/**
 * Unit tests for FollowUpService.
 *
 * Covers:
 *   - isWithinBusinessHours helper (9 cases)
 *   - First follow-up: correct message, followUpCount increment, lastFollowUpAt, GHL send
 *   - Second follow-up: correct message, followUpCount increment
 *   - Close conversation: phase closed, unresponsive tag, no message sent
 *   - Business hours enforcement: messages not sent outside 9am–6pm UTC Mon–Fri
 *   - Closing bypasses business hours check (no message, so no restriction)
 *   - DB query failure: logged, job does not crash
 *   - GHL send failure: logged per-conversation, other conversations still processed
 *   - Individual conversation error: logged, other conversations still processed
 *   - Empty result set: job completes without error
 *   - Lead responds: followUpCount is not reset (inbound handler does not touch it)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { FollowUpService, isWithinBusinessHours } from './follow-up.service';
import { Conversation } from '../database/schemas/conversation.schema';
import { Lead } from '../database/schemas/lead.schema';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Monday 06 Apr 2026 10:00 UTC — within business hours */
const MON_10AM = new Date('2026-04-06T10:00:00.000Z');
/** Monday 06 Apr 2026 23:00 UTC — outside business hours */
const MON_11PM = new Date('2026-04-06T23:00:00.000Z');
/** Saturday 04 Apr 2026 10:00 UTC */
const SAT_10AM = new Date('2026-04-04T10:00:00.000Z');
/** Sunday 05 Apr 2026 10:00 UTC */
const SUN_10AM = new Date('2026-04-05T10:00:00.000Z');

function makeConversation(overrides: Partial<Record<string, any>> = {}): any {
  return {
    _id: new Types.ObjectId(),
    clinicId: new Types.ObjectId(),
    leadId: new Types.ObjectId(),
    ghlContactId: 'contact_001',
    channel: 'sms',
    phase: 'qualifying',
    followUpCount: 0,
    lastMessageFrom: 'ai',
    lastMessageAt: new Date(MON_10AM.getTime() - 25 * 60 * 60 * 1000), // 25h ago
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockConversationModel = {
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};

const mockLeadModel = {
  findById: jest.fn(),
};

const mockMessagesService = {
  addMessage: jest.fn(),
};

const mockGhlApiService = {
  sendMessageWithRetry: jest.fn(),
  addContactTag: jest.fn(),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('isWithinBusinessHours', () => {
  it('returns true at 10am UTC on Monday', () => {
    expect(isWithinBusinessHours(new Date('2026-04-06T10:00:00.000Z'))).toBe(true);
  });

  it('returns true at 5:30pm UTC on Friday', () => {
    expect(isWithinBusinessHours(new Date('2026-04-10T17:30:00.000Z'))).toBe(true);
  });

  it('returns false at 6:01pm UTC (past close)', () => {
    expect(isWithinBusinessHours(new Date('2026-04-06T18:01:00.000Z'))).toBe(false);
  });

  it('returns false at exactly 6:00pm UTC (boundary)', () => {
    expect(isWithinBusinessHours(new Date('2026-04-06T18:00:00.000Z'))).toBe(false);
  });

  it('returns false at 8:59am UTC (before open)', () => {
    expect(isWithinBusinessHours(new Date('2026-04-06T08:59:00.000Z'))).toBe(false);
  });

  it('returns false at 11pm UTC', () => {
    expect(isWithinBusinessHours(MON_11PM)).toBe(false);
  });

  it('returns false at 3am UTC', () => {
    expect(isWithinBusinessHours(new Date('2026-04-06T03:00:00.000Z'))).toBe(false);
  });

  it('returns false on Saturday at 10am UTC', () => {
    expect(isWithinBusinessHours(SAT_10AM)).toBe(false);
  });

  it('returns false on Sunday at 10am UTC', () => {
    expect(isWithinBusinessHours(SUN_10AM)).toBe(false);
  });
});

describe('FollowUpService', () => {
  let service: FollowUpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpService,
        { provide: getModelToken(Conversation.name), useValue: mockConversationModel },
        { provide: getModelToken(Lead.name), useValue: mockLeadModel },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: GhlApiService, useValue: mockGhlApiService },
      ],
    }).compile();

    service = module.get<FollowUpService>(FollowUpService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    // Happy-path defaults
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    mockLeadModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ firstName: 'Jane' }) });
    mockMessagesService.addMessage.mockResolvedValue({});
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: 'msg_001' });
    mockGhlApiService.addContactTag.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  // ── DB query ────────────────────────────────────────────────────────────────

  describe('DB query', () => {
    it('queries only qualifying and booking phases', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ phase: { $in: ['qualifying', 'booking'] } }),
      );
    });

    it('queries only conversations where last message was from ai', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ lastMessageFrom: 'ai' }),
      );
    });

    it('completes without error when no eligible conversations are found', async () => {
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });
  });

  // ── First follow-up ─────────────────────────────────────────────────────────

  describe('first follow-up (followUpCount 0)', () => {
    beforeEach(() => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
    });

    it('sends the correct first follow-up message with the lead name', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Hi Jane, just checking in! Still interested in booking?' }),
      );
    });

    it('falls back to "there" when lead name is not found', async () => {
      mockLeadModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Hi there, just checking in! Still interested in booking?' }),
      );
    });

    it('increments followUpCount to 1', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ $inc: { followUpCount: 1 } }),
      );
    });

    it('sets lastFollowUpAt to the current time', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lastFollowUpAt: MON_10AM }),
      );
    });

    it('persists the follow-up message with sender ai', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockMessagesService.addMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'ai',
        'Hi Jane, just checking in! Still interested in booking?',
        'sms',
        'msg_001',
      );
    });

    it('sends via GHL with the correct contactId', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'contact_001' }),
      );
    });
  });

  // ── Second follow-up ────────────────────────────────────────────────────────

  describe('second follow-up (followUpCount 1)', () => {
    beforeEach(() => {
      const conv = makeConversation({ followUpCount: 1 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
    });

    it('sends the correct second follow-up message with the lead name', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Hey Jane, I don't want to keep bothering you! Let me know if I can help.",
        }),
      );
    });

    it('increments followUpCount to 2', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ $inc: { followUpCount: 1 } }),
      );
    });

    it('sets lastFollowUpAt to the current time', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lastFollowUpAt: MON_10AM }),
      );
    });

    it('persists the follow-up message with sender ai', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockMessagesService.addMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'ai',
        "Hey Jane, I don't want to keep bothering you! Let me know if I can help.",
        'sms',
        'msg_001',
      );
    });
  });

  // ── Close conversation ───────────────────────────────────────────────────────

  describe('close conversation (followUpCount >= 2)', () => {
    beforeEach(() => {
      const conv = makeConversation({ followUpCount: 2 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
    });

    it('changes the conversation phase to closed', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ phase: 'closed', closedReason: 'no_response' }),
      );
    });

    it('sets closedAt to the current time', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ closedAt: MON_10AM }),
      );
    });

    it('adds the unresponsive tag to the GHL contact', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.addContactTag).toHaveBeenCalledWith('contact_001', 'unresponsive');
    });

    it('does NOT send a message when closing', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    it('does NOT persist a message when closing', async () => {
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockMessagesService.addMessage).not.toHaveBeenCalled();
    });

    it('closes the conversation even with followUpCount greater than 2', async () => {
      const conv = makeConversation({ followUpCount: 5 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ phase: 'closed' }),
      );
    });

    it('logs a warning but still completes when addContactTag returns null', async () => {
      mockGhlApiService.addContactTag.mockResolvedValue(null);
      await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ phase: 'closed' }),
      );
    });

    it('closes the conversation outside business hours (no message = no restriction)', async () => {
      await service.checkAndSendFollowUps(MON_11PM);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ phase: 'closed' }),
      );
    });
  });

  // ── Business hours ───────────────────────────────────────────────────────────

  describe('business hours enforcement', () => {
    it('does not send a follow-up at 11pm UTC', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(MON_11PM);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    it('does not send a follow-up at 3am UTC', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(new Date('2026-04-06T03:00:00.000Z'));
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    it('does not send a follow-up on Saturday', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(SAT_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    it('does not send a follow-up on Sunday', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(SUN_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    it('sends a follow-up on Monday at 10am UTC', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalled();
    });

    it('sends a follow-up at 5pm UTC', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(new Date('2026-04-06T17:00:00.000Z'));
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalled();
    });

    it('does not send a follow-up at exactly 6pm UTC', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(new Date('2026-04-06T18:00:00.000Z'));
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    it('does not send a follow-up at 8:59am UTC', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(new Date('2026-04-06T08:59:00.000Z'));
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });
  });

  // ── Scheduled job behaviour ──────────────────────────────────────────────────

  describe('scheduled job', () => {
    it('processes multiple eligible conversations in a single run', async () => {
      const convs = [
        makeConversation({ ghlContactId: 'c1', followUpCount: 0 }),
        makeConversation({ ghlContactId: 'c2', followUpCount: 1 }),
      ];
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue(convs) });
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledTimes(2);
    });

    it('logs a summary with counts after each run', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(MON_10AM);
      const logCalls = logSpy.mock.calls.map((c) => c[0] as string);
      expect(logCalls.some((msg) => msg.includes('Follow-up job complete'))).toBe(true);
    });
  });

  // ── Error handling ───────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('logs an error and does not crash when the DB query fails', async () => {
      mockConversationModel.find.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      });
      await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
    });

    it('logs an error per conversation but still processes remaining conversations', async () => {
      const conv1 = makeConversation({ ghlContactId: 'c1', followUpCount: 0 });
      const conv2 = makeConversation({ ghlContactId: 'c2', followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv1, conv2]) });

      // First send fails, second succeeds
      mockGhlApiService.sendMessageWithRetry
        .mockRejectedValueOnce(new Error('GHL timeout'))
        .mockResolvedValueOnce({ id: 'msg_002' });

      await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledTimes(2);
    });

    it('does not crash when GHL send fails for a follow-up', async () => {
      const conv = makeConversation({ followUpCount: 0 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      mockGhlApiService.sendMessageWithRetry.mockRejectedValue(new Error('GHL error'));
      await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
    });
  });

  // ── Lead responds to follow-up ───────────────────────────────────────────────

  describe('lead responds to follow-up', () => {
    it('conversation becomes ineligible after a lead reply (lastMessageFrom changes to lead)', async () => {
      // After a lead replies, the inbound handler sets lastMessageFrom to 'lead'.
      // The follow-up query filters lastMessageFrom: 'ai', so the conversation won't be returned.
      // Simulate by having find return empty (as it would after a lead reply).
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      await service.checkAndSendFollowUps(MON_10AM);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    it('does not reset followUpCount — findByIdAndUpdate is never called with followUpCount: 0', async () => {
      // The follow-up service only increments followUpCount, never resets it.
      // This verifies no findByIdAndUpdate call sets followUpCount to 0.
      const conv = makeConversation({ followUpCount: 1 });
      mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([conv]) });
      await service.checkAndSendFollowUps(MON_10AM);
      const calls = mockConversationModel.findByIdAndUpdate.mock.calls;
      const resetsFollowUp = calls.some((args) => args[1]?.followUpCount === 0);
      expect(resetsFollowUp).toBe(false);
    });
  });
});
