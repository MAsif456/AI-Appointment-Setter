/** Tests for DB querying, scheduled job behaviour, error handling, and lead-responds scenarios. */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { FollowUpService } from './follow-up.service';
import { Conversation } from '../database/schemas/conversation.schema';
import { Lead } from '../database/schemas/lead.schema';
import { Clinic } from '../database/schemas/clinic.schema';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { EncryptionService } from '../common/encryption/encryption.service';

const MON_10AM = new Date('2026-04-06T10:00:00.000Z');

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
    lastMessageAt: new Date(MON_10AM.getTime() - 25 * 60 * 60 * 1000),
    ...overrides,
  };
}

const mockConversationModel = { find: jest.fn(), findByIdAndUpdate: jest.fn() };
const mockLeadModel = { findById: jest.fn() };
const mockMessagesService = { addMessage: jest.fn() };
const mockGhlApiService = { sendMessageWithRetry: jest.fn(), addContactTag: jest.fn() };

describe('FollowUpService — DB query, job, errors, and lead-responds', () => {
  let service: FollowUpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpService,
        { provide: getModelToken(Conversation.name), useValue: mockConversationModel },
        { provide: getModelToken(Lead.name), useValue: mockLeadModel },
        { provide: getModelToken(Clinic.name), useValue: { findById: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) } },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: GhlApiService, useValue: mockGhlApiService },
        { provide: EncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn().mockReturnValue('') } },
      ],
    }).compile();

    service = module.get<FollowUpService>(FollowUpService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    mockLeadModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ firstName: 'Jane' }) });
    mockMessagesService.addMessage.mockResolvedValue({});
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: 'msg_001' });
    mockGhlApiService.addContactTag.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  // ── DB query ──────────────────────────────────────────────────────────────────

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
    await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  // ── Scheduled job ─────────────────────────────────────────────────────────────

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
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(MON_10AM);
    const logCalls = logSpy.mock.calls.map((c) => c[0] as string);
    expect(logCalls.some((msg) => msg.includes('Follow-up job complete'))).toBe(true);
  });

  // ── Error handling ────────────────────────────────────────────────────────────

  it('logs an error and does not crash when the DB query fails', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockRejectedValue(new Error('DB connection lost')) });
    await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
  });

  it('logs an error per conversation but still processes remaining conversations', async () => {
    const convs = [
      makeConversation({ ghlContactId: 'c1', followUpCount: 0 }),
      makeConversation({ ghlContactId: 'c2', followUpCount: 0 }),
    ];
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue(convs) });
    mockGhlApiService.sendMessageWithRetry
      .mockRejectedValueOnce(new Error('GHL timeout'))
      .mockResolvedValueOnce({ id: 'msg_002' });

    await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledTimes(2);
  });

  it('does not crash when GHL send fails for a follow-up', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    mockGhlApiService.sendMessageWithRetry.mockRejectedValue(new Error('GHL error'));
    await expect(service.checkAndSendFollowUps(MON_10AM)).resolves.not.toThrow();
  });

  // ── Lead responds ─────────────────────────────────────────────────────────────

  it('conversation becomes ineligible after a lead reply (lastMessageFrom changes to lead)', async () => {
    // After a lead replies, lastMessageFrom is set to 'lead' by the inbound handler.
    // The query filters lastMessageFrom: 'ai', so the conversation won't be returned.
    await service.checkAndSendFollowUps(MON_10AM);
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  it('does not reset followUpCount — findByIdAndUpdate is never called with followUpCount: 0', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation({ followUpCount: 1 })]) });
    await service.checkAndSendFollowUps(MON_10AM);
    const calls = mockConversationModel.findByIdAndUpdate.mock.calls;
    expect(calls.some((args) => args[1]?.followUpCount === 0)).toBe(false);
  });
});
