/** Tests for first and second follow-up message content, DB updates, and GHL sending. */
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

describe('FollowUpService — first follow-up (followUpCount 0)', () => {
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

    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation({ followUpCount: 0 })]) });
    mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    mockLeadModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ firstName: 'Jane' }) });
    mockMessagesService.addMessage.mockResolvedValue({});
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: 'msg_001' });
    mockGhlApiService.addContactTag.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends the correct first follow-up message with the lead name', async () => {
    await service.checkAndSendFollowUps(MON_10AM);
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: 'Hi Jane, just checking in! Still interested in booking?' }),
    );
  });

  it('falls back to "there" when lead name is not found', async () => {
    mockLeadModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    await service.checkAndSendFollowUps(MON_10AM);
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.any(String),
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
      expect.anything(), expect.anything(), expect.anything(),
      'ai', 'Hi Jane, just checking in! Still interested in booking?', 'sms', 'msg_001',
    );
  });

  it('sends via GHL with the correct contactId', async () => {
    await service.checkAndSendFollowUps(MON_10AM);
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ contactId: 'contact_001' }),
    );
  });
});

describe('FollowUpService — second follow-up (followUpCount 1)', () => {
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

    mockConversationModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([makeConversation({ followUpCount: 1 })]) });
    mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    mockLeadModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ firstName: 'Jane' }) });
    mockMessagesService.addMessage.mockResolvedValue({});
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: 'msg_001' });
    mockGhlApiService.addContactTag.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends the correct second follow-up message with the lead name', async () => {
    await service.checkAndSendFollowUps(MON_10AM);
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: "Hey Jane, I don't want to keep bothering you! Let me know if I can help." }),
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
      expect.anything(), expect.anything(), expect.anything(),
      'ai', "Hey Jane, I don't want to keep bothering you! Let me know if I can help.", 'sms', 'msg_001',
    );
  });
});
