/** Tests for isWithinBusinessHours helper and business-hours enforcement on follow-up sending. */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { FollowUpService, isWithinBusinessHours } from './follow-up.service';
import { Conversation } from '../database/schemas/conversation.schema';
import { Lead } from '../database/schemas/lead.schema';
import { Clinic } from '../database/schemas/clinic.schema';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { InboxNotificationService } from '../notifications/inbox-notification.service';
import { EncryptionService } from '../common/encryption/encryption.service';

const MON_10AM = new Date('2026-04-06T10:00:00.000Z');
const MON_11PM = new Date('2026-04-06T23:00:00.000Z');
const SAT_10AM = new Date('2026-04-04T10:00:00.000Z');
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
    lastMessageAt: new Date(MON_10AM.getTime() - 25 * 60 * 60 * 1000),
    ...overrides,
  };
}

const mockConversationModel = { find: jest.fn(), findByIdAndUpdate: jest.fn() };
const mockLeadModel = { findById: jest.fn() };
const mockMessagesService = { addMessage: jest.fn() };
const mockGhlApiService = { sendMessageWithRetry: jest.fn(), addContactTag: jest.fn() };
const mockInboxNotificationService = { createForClinicStaff: jest.fn().mockResolvedValue(undefined) };

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

describe('FollowUpService — business hours enforcement', () => {
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
        { provide: InboxNotificationService, useValue: mockInboxNotificationService },
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

  it('does not send a follow-up at 11pm UTC', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(MON_11PM);
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  it('does not send a follow-up at 3am UTC', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(new Date('2026-04-06T03:00:00.000Z'));
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  it('does not send a follow-up on Saturday', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(SAT_10AM);
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  it('does not send a follow-up on Sunday', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(SUN_10AM);
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  it('sends a follow-up on Monday at 10am UTC', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(MON_10AM);
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalled();
  });

  it('sends a follow-up at 5pm UTC', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(new Date('2026-04-06T17:00:00.000Z'));
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalled();
  });

  it('does not send a follow-up at exactly 6pm UTC', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(new Date('2026-04-06T18:00:00.000Z'));
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  it('does not send a follow-up at 8:59am UTC', async () => {
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    await service.checkAndSendFollowUps(new Date('2026-04-06T08:59:00.000Z'));
    expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
  });
});
