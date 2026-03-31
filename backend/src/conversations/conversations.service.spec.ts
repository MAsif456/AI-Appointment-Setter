import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsPersistenceService } from './conversations.persistence.service';
import { ChatService } from '../ai/chat.service';
import { SlotProvider } from '../ai/slot-provider';
import { AppointmentsService } from '../appointments/appointments.service';
import { UrgencyPipeline } from '../ai/urgency-pipeline';
import { EscalationService } from '../ai/escalation.service';
import { AbuseHandlerService } from './abuse-handler.service';
import { CancellationService } from '../cancellation/cancellation.service';
import { PatientHistoryService } from '../patient-history/patient-history.service';
import { PostcodeValidationService } from '../orchestrator/postcode-validation.service';

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

  const mockAbuseHandler = {
    handle: jest.fn().mockResolvedValue(null),
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

  const mockCancellationService = {
    checkAppointmentExists: jest.fn().mockResolvedValue(null),
    buildConfirmationPrompt: jest.fn(),
    evaluatePolicy: jest.fn(),
    executeCancellation: jest.fn(),
    isAwaitingReason: jest.fn().mockResolvedValue(false),
    requestReason: jest.fn(),
    storeReason: jest.fn(),
  };

  const mockPersistenceService = {
    saveMessage: jest.fn().mockResolvedValue({}),
    updateConversationMeta: jest.fn().mockResolvedValue({}),
    storeOfferedSlots: jest.fn().mockResolvedValue({}),
    saveDateContext: jest.fn().mockResolvedValue({}),
  };

  // Shared test fixtures
  const mockConversation = {
    _id: 'conv1',
    clinicId: 'clinic1',
    leadId: 'lead1',
    channel: 'website',
    phase: 'greeting',
    isReturningPatient: false,
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
        { provide: AbuseHandlerService, useValue: mockAbuseHandler },
        { provide: AppointmentsService, useValue: mockAppointmentsService },
        { provide: UrgencyPipeline, useValue: mockUrgencyPipeline },
        { provide: EscalationService, useValue: mockEscalationService },
        { provide: CancellationService, useValue: mockCancellationService },
        { provide: ConversationsPersistenceService, useValue: mockPersistenceService },
        { provide: PatientHistoryService, useValue: { findReturningPatient: jest.fn().mockResolvedValue(null), persistHistory: jest.fn() } },
        PostcodeValidationService,
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
      expect(mockPersistenceService.saveMessage).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), 'ai', 'Hi Sarah!',
      );
    });

    it('should return fallback when greeting fails', async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.startConversation.mockResolvedValue(null);

      const result = await service.startConversation('conv1');
      expect(result).toBe('Thanks for your message! Someone from the clinic will be in touch shortly.');
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
        expect.objectContaining({ $set: expect.objectContaining({ phase: 'greeting', messageCount: 0 }) }),
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
      // Should save two lead messages (with/without urgency data) + one AI reply
      expect(mockPersistenceService.saveMessage).toHaveBeenCalledTimes(3);
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

    it('should return fallback message when AI fails', async () => {
      mockConversationModel.findById.mockResolvedValue(mockConversation);
      mockMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockChatService.sendMessage.mockResolvedValue(null);

      const result = await service.sendMessage('conv1', 'Hello');

      // Service returns null when AI fails; controller wraps with fallback
      expect(result).toBeNull();
      expect(mockPersistenceService.saveMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancellation intercept', () => {
    const bookedConversation = { ...mockConversation, phase: 'booked' };
    const cancellingConversation = { ...mockConversation, phase: 'cancelling' };
    const mockAppointment = { _id: 'apt_1', appointmentDate: new Date(), status: 'confirmed' };

    beforeEach(() => {
      mockMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
      mockClinicModel.findById.mockResolvedValue(mockClinic);
      mockLeadModel.findById.mockResolvedValue(mockLead);
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    });

    it('should intercept "cancel" keyword in booked phase and return confirmation', async () => {
      mockConversationModel.findById.mockResolvedValue(bookedConversation);
      mockCancellationService.checkAppointmentExists.mockResolvedValue(mockAppointment);
      mockCancellationService.buildConfirmationPrompt.mockReturnValue(
        "Just to confirm, you'd like to cancel your appointment on Friday 3rd April at 10:20 AM. Is that correct?",
      );

      const result = await service.sendMessage('conv1', 'I want to cancel my appointment');

      expect(result!.reply).toContain('cancel your appointment');
      expect(mockCancellationService.checkAppointmentExists).toHaveBeenCalled();
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('should intercept confirm keyword in cancelling phase and ask for reason', async () => {
      mockConversationModel.findById.mockResolvedValue(cancellingConversation);
      mockCancellationService.checkAppointmentExists.mockResolvedValue(mockAppointment);
      mockCancellationService.evaluatePolicy.mockResolvedValue({ withinNotice: false, feeEnabled: false });
      mockCancellationService.isAwaitingReason.mockResolvedValue(false);
      mockCancellationService.requestReason.mockResolvedValue('May I ask the reason for cancelling?');

      const result = await service.sendMessage('conv1', 'yes');

      expect(result!.reply).toContain('reason for cancelling');
      expect(mockCancellationService.executeCancellation).not.toHaveBeenCalled();
    });

    it('should execute cancellation when reason is provided as freeform text', async () => {
      mockConversationModel.findById.mockResolvedValue(cancellingConversation);
      mockCancellationService.isAwaitingReason.mockResolvedValue(true);
      mockCancellationService.checkAppointmentExists.mockResolvedValue(mockAppointment);
      mockCancellationService.executeCancellation.mockResolvedValue({
        success: true,
        message: 'Your appointment has been cancelled. Feel free to book again anytime!',
      });

      const result = await service.sendMessage('conv1', 'Moving away from the area');

      expect(result!.reply).toContain('cancelled');
      expect(mockCancellationService.storeReason).toHaveBeenCalledWith(expect.anything(), 'Moving away from the area');
    });

    it('should intercept decline keyword and reassure appointment is kept', async () => {
      mockConversationModel.findById.mockResolvedValue(cancellingConversation);

      const result = await service.sendMessage('conv1', 'no, keep it');

      expect(result!.reply).toContain('still confirmed');
      expect(mockCancellationService.executeCancellation).not.toHaveBeenCalled();
    });

    it('should not intercept cancellation keywords in non-cancellation phases', async () => {
      mockConversationModel.findById.mockResolvedValue({ ...mockConversation, phase: 'qualifying' });
      mockChatService.sendMessage.mockResolvedValue('How can I help?');

      await service.sendMessage('conv1', 'I want to cancel my appointment');

      expect(mockCancellationService.checkAppointmentExists).not.toHaveBeenCalled();
      expect(mockChatService.sendMessage).toHaveBeenCalled();
    });
  });
});
