/**
 * Integration tests for the slot-selection detection behaviour wired into
 * ConversationsService.sendMessage().
 *
 * These tests verify that, when a lead replies after slots have been offered,
 * the service correctly detects their intent and returns a slotSelection result.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConversationsService } from './conversations.service';
import { ChatService } from '../ai/chat.service';
import { SlotProvider } from '../ai/slot-provider';
import { AppointmentsService } from '../appointments/appointments.service';
import { UrgencyPipeline } from '../ai/urgency-pipeline';
import { EscalationService } from '../ai/escalation.service';
import { AbuseHandlerService } from './abuse-handler.service';

describe('ConversationsService – slot selection detection', () => {
  let service: ConversationsService;

  // Re-usable slot fixture returned by the mock SlotProvider
  const mockAvailableSlots = [
    { date: '2026-03-24', startTime: '14:00', endTime: '14:30' }, // Tuesday 2pm
    { date: '2026-03-25', startTime: '10:00', endTime: '10:30' }, // Wednesday 10am
    { date: '2026-03-26', startTime: '15:00', endTime: '15:30' }, // Thursday 3pm
  ];

  // Previously offered slots already stored on the conversation document
  const offeredSlots = [
    { dateTime: new Date('2026-03-24T14:00:00'), displayText: 'Tuesday 24th March at 2pm' },
    { dateTime: new Date('2026-03-25T10:00:00'), displayText: 'Wednesday 25th March at 10am' },
    { dateTime: new Date('2026-03-26T15:00:00'), displayText: 'Thursday 26th March at 3pm' },
  ];

  const mockConversationWithSlots = {
    _id: 'conv1',
    clinicId: 'clinic1',
    leadId: 'lead1',
    channel: 'website',
    phase: 'booking',
    offeredSlots,
  };

  const mockConversationNoSlots = {
    _id: 'conv1',
    clinicId: 'clinic1',
    leadId: 'lead1',
    channel: 'website',
    phase: 'greeting',
    offeredSlots: [],
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
    issue: 'Back Pain',
  };

  const mockConversationModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  };
  const mockMessageModel = {
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
    create: jest.fn().mockResolvedValue({}),
  };
  const mockClinicModel = { findById: jest.fn().mockResolvedValue(mockClinic) };
  const mockLeadModel = { findById: jest.fn().mockResolvedValue(mockLead), findByIdAndUpdate: jest.fn().mockResolvedValue({}) };
  const mockChatService = { sendMessage: jest.fn().mockResolvedValue('AI reply') };
  const mockSlotProvider = { getAvailableSlots: jest.fn().mockResolvedValue(mockAvailableSlots) };
  const mockAbuseHandler = { handle: jest.fn().mockResolvedValue(null) };
  const mockAppointmentsService = {
    bookAppointment: jest.fn().mockResolvedValue({ success: true, confirmationMessage: 'Booked!' }),
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
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    jest.clearAllMocks();
    // Restore defaults after clearAllMocks
    mockChatService.sendMessage.mockResolvedValue('AI reply');
    mockSlotProvider.getAvailableSlots.mockResolvedValue(mockAvailableSlots);
    mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
    mockMessageModel.create.mockResolvedValue({});
    mockClinicModel.findById.mockResolvedValue(mockClinic);
    mockLeadModel.findById.mockResolvedValue(mockLead);
    mockMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    mockAppointmentsService.bookAppointment.mockResolvedValue({ success: true, confirmationMessage: 'Booked!' });
    mockUrgencyPipeline.assessMessage.mockResolvedValue({
      resolved: 'routine',
      assessment: { level: 'routine', score: 0.1, signals: [], isAmbiguous: false, requiresEscalation: false, emergencyKeywordsMatched: [] },
    });
    mockEscalationService.updateGhlTags.mockResolvedValue(undefined);
  });

  /** Registers a conversation document to be returned by findById */
  function useConversation(conv: typeof mockConversationWithSlots | typeof mockConversationNoSlots) {
    mockConversationModel.findById.mockResolvedValue(conv);
  }

  it('returns slotSelection: null when no slots were previously offered', async () => {
    useConversation(mockConversationNoSlots);
    const result = await service.sendMessage('conv1', 'Hi, can I book?');
    expect(result).not.toBeNull();
    expect(result!.slotSelection).toBeNull();
  });

  it('returns SLOT_SELECTED and auto-books when the lead picks a specific day', async () => {
    useConversation(mockConversationWithSlots);
    const result = await service.sendMessage('conv1', 'Tuesday please');
    expect(result!.slotSelection?.intent).toBe('SLOT_SELECTED');
    expect(result!.slotSelection?.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
    expect(mockAppointmentsService.bookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic1',
        leadId: 'lead1',
        conversationId: 'conv1',
      }),
    );
    expect(result!.bookingResult?.success).toBe(true);
  });

  it('returns AMBIGUOUS when two slots share the same day and only day is given', async () => {
    const twoTuesdaySlots = [
      { dateTime: new Date('2026-03-24T14:00:00'), displayText: 'Tuesday 24th March at 2pm' },
      { dateTime: new Date('2026-03-24T16:00:00'), displayText: 'Tuesday 24th March at 4pm' },
    ];
    mockConversationModel.findById.mockResolvedValue({
      ...mockConversationWithSlots,
      offeredSlots: twoTuesdaySlots,
    });
    const result = await service.sendMessage('conv1', 'Tuesday');
    expect(result!.slotSelection?.intent).toBe('AMBIGUOUS');
    expect(result!.slotSelection?.ambiguousSlots).toHaveLength(2);
  });

  it('returns NONE_SUITABLE and passes selection context to AI', async () => {
    useConversation(mockConversationWithSlots);
    await service.sendMessage('conv1', 'None of those work for me');
    // Verify the AI was called with selection context containing NONE_SUITABLE
    const callArgs = mockChatService.sendMessage.mock.calls[0];
    const options = callArgs[4]; // 5th argument: options
    expect(options.slotOptions.selectionContext?.intent).toBe('NONE_SUITABLE');
  });

  it('returns DIFFERENT_DATE and fetches slots for requested day', async () => {
    useConversation(mockConversationWithSlots);
    const result = await service.sendMessage('conv1', 'Do you have anything on Friday?');
    expect(result!.slotSelection?.intent).toBe('DIFFERENT_DATE');
    expect(result!.slotSelection?.requestedDate).toBe('Friday');
    expect(mockSlotProvider.getAvailableSlots).toHaveBeenCalled();
  });

  it('returns DIFFERENT_TIME and filters slots to morning band', async () => {
    useConversation(mockConversationWithSlots);
    const result = await service.sendMessage('conv1', 'Do you have anything earlier in the morning?');
    expect(result!.slotSelection?.intent).toBe('DIFFERENT_TIME');
    expect(result!.slotSelection?.timePreference).toBe('morning');
    // Wednesday 10am is the only morning slot in the mock data
    expect((result!.offeredSlots as Array<{ displayText: string }>).some(s => s.displayText.includes('10am'))).toBe(true);
  });
});
