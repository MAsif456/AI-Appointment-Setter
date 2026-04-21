/** Tests for closing a conversation after 2 follow-ups with no response. */
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
import { InboxNotificationService } from '../notifications/inbox-notification.service';
import { EncryptionService } from '../common/encryption/encryption.service';

const MON_10AM = new Date('2026-04-06T10:00:00.000Z');
const MON_11PM = new Date('2026-04-06T23:00:00.000Z');

function makeConversation(overrides: Partial<Record<string, any>> = {}): any {
  return {
    _id: new Types.ObjectId(),
    clinicId: new Types.ObjectId(),
    leadId: new Types.ObjectId(),
    ghlContactId: 'contact_001',
    channel: 'sms',
    phase: 'qualifying',
    followUpCount: 2,
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

describe('FollowUpService — close conversation (followUpCount >= 2)', () => {
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

    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation()]) });
    mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    mockLeadModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ firstName: 'Jane' }) });
    mockMessagesService.addMessage.mockResolvedValue({});
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: 'msg_001' });
    mockGhlApiService.addContactTag.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

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
    expect(mockGhlApiService.addContactTag).toHaveBeenCalledWith(expect.any(String), 'contact_001', 'unresponsive');
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
    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation({ followUpCount: 5 })]) });
    await service.checkAndSendFollowUps(MON_10AM);
    expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'closed' }),
    );
  });

  it('still completes when addContactTag returns null', async () => {
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
