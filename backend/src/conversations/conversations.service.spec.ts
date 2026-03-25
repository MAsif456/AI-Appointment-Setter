import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ChatService } from '../ai/chat.service';
import { SlotProvider } from '../ai/slot-provider';
import { AppointmentsService } from '../appointments/appointments.service';
import { UrgencyPipeline } from '../ai/urgency-pipeline';
import { EscalationService } from '../ai/escalation.service';

describe('ConversationsService', () => {
  let service: ConversationsService;

  // Mock Mongoose models
  const mockConversationModel = {
    findById: jest.fn(),
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    findByIdAndUpdate: jest.fn(),
  };

  const mockMessageModel = {
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
    create: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  };

  const mockClinicModel = { findById: jest.fn() };
  const mockLeadModel = { findById: jest.fn(), findByIdAndUpdate: jest.fn().mockResolvedValue({}) };

  const mockChatService = {
    startConversation: jest.fn(),
    sendMessage: jest.fn(),
  };

  const mockSlotProvider = {
    getAvailableSlots: jest.fn().mockResolvedValue([
      { date: '2026-03-17', startTime: '14:00', endTime: '14:30' },
    ]),
  };

  const mockAppointmentsService = {
    bookAppointment: jest.fn(),
  };

  const mockUrgencyPipeline = {
    assessMessage: jest.fn().mockResolvedValue({
      resolved: 'routine',
      assessment: { level: 'routine', score: 0.1, signals: [], isAmbiguous: false, requiresEscalation: false, emergencyKeywordsMatched: [] },
    }),
    assessFormData: jest.fn().mockReturnValue({
      resolved: 'routine',
      assessment: { level: 'routine', score: 0.1, signals: [], isAmbiguous: false, requiresEscalation: false, emergencyKeywordsMatched: [] },
    }),
  };

  const mockEscalationService = {
    escalateEmergency: jest.fn(),
    handleNoSlotsForUrgent: jest.fn(),
    notifyClinicStaff: jest.fn(),
    updateGhlTags: jest.fn().mockResolvedValue(undefined),
  };

  // Shared test fixtures
  const mockConversation = {
    _id: 'conv1',
    clinicId: 'clinic1',
    leadId: 'lead1',
    channel: 'website',
    phase: 'greeting',
  };

  const mockClinic = {
    _id: 'clinic1',
    name: 'Cardiff Physiotherapy Centre',
    ghlLocationId: 'loc1',
    isActive: true,
    aiConfig: { tone: 'friendly', greetingTemplate: '', customInstructions: '' },
    serviceAreas: [{ postcodePrefix: 'CF' }],
  };

  const mockLead = {
    _id: 'lead1',
    firstName: 'Sarah',
    lastName: 'Williams',
    phone: '07700 900123',
    email: 'sarah@email.com',
    issue: 'Back Pain',
    leadSource: 'facebook',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: getModelToken('Conversation'), useValue: mockConversationModel },
        { provide: getModelToken('Message'), useValue: mockMessageModel },
        { provide: getModelToken('Clinic'), useValue: mockClinicModel },
        { provide: getModelToken('Lead'), useValue: mockLeadModel },
        { provide: ChatService, useValue: mockChatService },
        { provide: SlotProvider, useValue: mockSlotProvider },
        { provide: AppointmentsService, useValue: mockAppointmentsService },
        { provide: UrgencyPipeline, useValue: mockUrgencyPipeline },
        { provide: EscalationService, useValue: mockEscalationService },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    jest.clearAllMocks();
  });

  describe('getConversation', () => {
    it('should return conversation with messages, clinic, and lead', async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);

      const result = await service.getConversation('conv1');

      expect(result.conversation).toEqual(mockConversation);
      expect(result.clinic).toEqual(mockClinic);
      expect(result.lead).toEqual(mockLead);
    });

    it('should throw NotFoundException for invalid ID', async () => {
      mockConversationModel.findById.mockResolvedValue(null);
      await expect(service.getConversation('bad_id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('startConversation', () => {
    it('should generate greeting and save as message', async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.startConversation.mockResolvedValue('Hi Sarah!');
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.startConversation('conv1');

      expect(result).toBe('Hi Sarah!');
      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ sender: 'ai', content: 'Hi Sarah!' }),
      );
    });

    it('should return null when greeting fails', async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.startConversation.mockResolvedValue(null);

      const result = await service.startConversation('conv1');
      expect(result).toBeNull();
    });
  });

  describe('resetConversation', () => {
    it('should delete messages and reset conversation phase and lead urgency', async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      await service.resetConversation('conv1');

      expect(mockMessageModel.deleteMany).toHaveBeenCalledWith({
        conversationId: 'conv1',
      });
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv1',
        expect.objectContaining({ phase: 'greeting', messageCount: 0 }),
      );
      expect(mockLeadModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'lead1',
        { urgency: 'unknown' },
      );
    });

    it('should throw NotFoundException for invalid ID', async () => {
      mockConversationModel.findById.mockResolvedValue(null);
      await expect(service.resetConversation('bad_id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('sendMessage', () => {
    it('should save user message and AI reply with offered slots', async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { sender: 'ai', content: 'Hi Sarah!' },
        ]),
      });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.sendMessage.mockResolvedValue('Let me check that.');
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.sendMessage('conv1', 'My postcode is CF10');

      expect(result).not.toBeNull();
      expect(result!.reply).toBe('Let me check that.');
      expect(result!.offeredSlots).toBeDefined();
      // Should create two messages: user + AI
      expect(mockMessageModel.create).toHaveBeenCalledTimes(2);
    });

    it('should return follow-up message when conversation is already escalated', async () => {
      const escalatedConversation = { ...mockConversation, phase: 'escalated' };
      mockConversationModel.findById.mockResolvedValue(escalatedConversation);
      mockMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockUrgencyPipeline.assessMessage.mockResolvedValueOnce({
        resolved: 'emergency',
        assessment: { level: 'emergency', score: 1.0, signals: [], isAmbiguous: false, requiresEscalation: true, emergencyKeywordsMatched: [] },
      });
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.sendMessage('conv1', 'actually its fine now');

      expect(result!.reply).toContain('already been flagged');
      expect(result!.reply).toContain('999');
      // Should NOT call escalateEmergency again
      expect(mockEscalationService.escalateEmergency).not.toHaveBeenCalled();
    });

    it('should return null when AI fails', async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.sendMessage.mockResolvedValue(null);

      const result = await service.sendMessage('conv1', 'Hello');

      expect(result).toBeNull();
      // Only the user message should be saved, not an AI reply
      expect(mockMessageModel.create).toHaveBeenCalledTimes(1);
    });
  });
});
