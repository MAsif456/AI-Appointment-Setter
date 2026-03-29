/**
 * Unit tests for OrchestratorService.handleInboundMessage().
 *
 * Covers all branches of the InboundMessage webhook flow:
 *   - Missing contactId → returns early
 *   - No existing conversation → creates one
 *   - New conversation creation failure → returns early
 *   - AI response returns null → falls back to FALLBACK_MESSAGE
 *   - GHL send failure → logs error, continues to persist
 *   - PROVIDE_POSTCODE intent → phase transitions to 'qualified'
 *   - WANT_TO_BOOK intent → phase transitions to 'booking'
 *   - UNKNOWN intent → no phase change
 *   - Channel mapping from GHL message type (e.g. WhatsApp → whatsapp)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrchestratorService, FALLBACK_MESSAGE } from './orchestrator.service';
import { GreetingService } from '../ai/greeting.service';
import { GroqService } from '../ai/groq.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { CancellationService } from '../cancellation/cancellation.service';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';

const mockGreetingService = { generateGreeting: jest.fn() };
const mockGroqService = { generateResponse: jest.fn(), generateChatResponse: jest.fn() };
const mockCancellationService = { checkAppointmentExists: jest.fn(), buildConfirmationPrompt: jest.fn(), evaluatePolicy: jest.fn(), executeCancellation: jest.fn(), isAwaitingReason: jest.fn(), requestReason: jest.fn(), storeReason: jest.fn() };
const mockConversationsService = { findByGhlContactId: jest.fn(), createForNewLead: jest.fn(), updatePhase: jest.fn() };
const mockMessagesService = { addMessage: jest.fn(), getByConversation: jest.fn() };
const mockGhlApiService = { sendMessageWithRetry: jest.fn(), getConversation: jest.fn(), createConversation: jest.fn() };

/** Clinic config with a valid 24-char hex ObjectId required by handleInboundMessage. */
const clinicConfig: ClinicConfig = {
  clinicId: '507f1f77bcf86cd799439013',
  name: 'Cardiff Physiotherapy Centre',
  tone: 'Friendly',
  serviceAreas: ['CF', 'NP'],
  ghlLocationId: 'loc_cardiff_001',
  isActive: true,
};

/** Mock conversation document in the qualifying phase. */
const mockConversation = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
  leadId: new Types.ObjectId('507f1f77bcf86cd799439012'),
  channel: 'sms',
  phase: 'qualifying',
};

describe('OrchestratorService — handleInboundMessage', () => {
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
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    // Happy-path defaults
    mockConversationsService.findByGhlContactId.mockResolvedValue(mockConversation);
    mockConversationsService.createForNewLead.mockResolvedValue(mockConversation);
    mockMessagesService.addMessage.mockResolvedValue({});
    mockMessagesService.getByConversation.mockResolvedValue([]);
    mockGroqService.generateChatResponse.mockResolvedValue('AI chat response');
    mockGroqService.generateResponse.mockResolvedValue('AI response');
    mockGhlApiService.sendMessageWithRetry.mockResolvedValue({ id: 'msg_001' });
    mockConversationsService.updatePhase.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  it('should return early without loading the conversation when contactId is absent', async () => {
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, message: { body: 'Hi' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.findByGhlContactId).not.toHaveBeenCalled();
  });

  it('should create a new conversation when none is found for the contact', async () => {
    mockConversationsService.findByGhlContactId.mockResolvedValue(null);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'Hi' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.createForNewLead).toHaveBeenCalled();
  });

  it('should return early when new conversation creation fails', async () => {
    mockConversationsService.findByGhlContactId.mockResolvedValue(null);
    mockConversationsService.createForNewLead.mockRejectedValue(new Error('DB error'));
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'Hi' } } as any,
      clinicConfig,
    );
    expect(mockMessagesService.addMessage).not.toHaveBeenCalled();
  });

  it('should send FALLBACK_MESSAGE when AI response generation returns null', async () => {
    mockGroqService.generateChatResponse.mockResolvedValue(null);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'Tell me more' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: FALLBACK_MESSAGE }),
    );
  });

  it('should persist both the lead message and the AI reply even when GHL send fails', async () => {
    mockGhlApiService.sendMessageWithRetry.mockRejectedValue(new Error('send failed'));
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'Hi' } } as any,
      clinicConfig,
    );
    expect(mockMessagesService.addMessage).toHaveBeenCalledTimes(2);
  });

  it('should transition phase to "qualified" when a valid postcode is detected', async () => {
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'My postcode is CF10 1AA' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'qualified');
  });

  it('should transition phase to "booking" when booking intent is detected in the qualified phase', async () => {
    mockConversationsService.findByGhlContactId.mockResolvedValue({ ...mockConversation, phase: 'qualified' });
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'I would like to book' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'booking');
  });

  it('should not update the phase for an UNKNOWN intent', async () => {
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'Just saying hi' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).not.toHaveBeenCalled();
  });

  it('should transition phase to "cancelling" when CANCEL intent is detected in booked phase', async () => {
    mockConversationsService.findByGhlContactId.mockResolvedValue({ ...mockConversation, phase: 'booked' });
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'I want to cancel' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'cancelling');
  });

  it('should transition phase to "cancelling_warned" when CONFIRM_CANCEL response includes a fee warning', async () => {
    mockConversationsService.findByGhlContactId.mockResolvedValue({ ...mockConversation, phase: 'cancelling' });
    jest.spyOn(service as any, 'generateResponse').mockResolvedValue(
      'Cancellations within 24 hours may incur a fee of £50. Would you like to proceed or reschedule instead?',
    );
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'yes please cancel it' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'cancelling_warned');
  });

  it('should not update phase to cancelling_warned when CONFIRM_CANCEL response is a plain cancellation message', async () => {
    mockConversationsService.findByGhlContactId.mockResolvedValue({ ...mockConversation, phase: 'cancelling' });
    jest.spyOn(service as any, 'generateResponse').mockResolvedValue(
      'Your appointment has been cancelled.',
    );
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'yes please cancel it' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).not.toHaveBeenCalledWith(expect.anything(), 'cancelling_warned');
  });

  it('should transition phase to "rescheduling" when DECLINE_CANCEL from cancelling_warned phase', async () => {
    mockConversationsService.findByGhlContactId.mockResolvedValue({ ...mockConversation, phase: 'cancelling_warned' });
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'no, keep my appointment' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'rescheduling');
  });

  it('should transition phase to "booked" when DECLINE_CANCEL from cancelling phase', async () => {
    mockConversationsService.findByGhlContactId.mockResolvedValue({ ...mockConversation, phase: 'cancelling' });
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'no, keep my appointment' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'booked');
  });

  it('should map WhatsApp message type to the whatsapp channel', async () => {
    await service.handleInboundMessage(
      {
        type: 'InboundMessage',
        location: { id: 'loc_001' },
        id: 'contact_001',
        message: { body: 'Hi', type: 'WhatsApp' },
      } as any,
      clinicConfig,
    );
    expect(mockMessagesService.addMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'lead',
      'Hi',
      'whatsapp',
    );
  });
});
