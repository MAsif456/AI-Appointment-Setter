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
 *   - RESCHEDULE intent → phase transitions to 'rescheduling'
 *   - CANCEL_RESCHEDULE intent → phase transitions back to 'booked'
 *   - Rescheduling slot flow (offer slots, select slot, cancel+rebook)
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
import { PostcodeValidationService } from './postcode-validation.service';
import { SlotProvider } from '../ai/slot-provider';
import { AppointmentsService } from '../appointments/appointments.service';
import { INVALID_POSTCODE_RESPONSE, NO_APPOINTMENT_RESPONSE } from './orchestrator.types';
import { SecurityPipelineService } from '../security/security-pipeline.service';
import { PatientHistoryService } from '../patient-history/patient-history.service';

const mockSecurityPipeline = {
  processInbound: jest.fn().mockImplementation((msg: string) =>
    Promise.resolve({ allowed: true, sanitisedMessage: msg, threatScore: 0, flags: [] }),
  ),
  validateOutput: jest.fn().mockReturnValue({ safe: true, flags: [] }),
};

const mockGreetingService = { generateGreeting: jest.fn() };
const mockGroqService = { generateResponse: jest.fn(), generateChatResponse: jest.fn() };
const mockCancellationService = { checkAppointmentExists: jest.fn(), buildConfirmationPrompt: jest.fn(), evaluatePolicy: jest.fn(), executeCancellation: jest.fn(), isAwaitingReason: jest.fn(), requestReason: jest.fn(), storeReason: jest.fn() };
const mockConversationsService = { findByGhlContactId: jest.fn(), createForNewLead: jest.fn(), updatePhase: jest.fn(), flagForHumanIntervention: jest.fn(), setContext: jest.fn() };
const mockMessagesService = { addMessage: jest.fn(), getByConversation: jest.fn() };
const mockGhlApiService = {
  sendMessageWithRetry: jest.fn(),
  getConversation: jest.fn(),
  createConversation: jest.fn(),
  cancelAppointment: jest.fn(),
  addContactTag: jest.fn(),
  updateContactCustomField: jest.fn(),
};
const mockSlotProvider = { getAvailableSlots: jest.fn() };
const mockAppointmentsService = { bookAppointment: jest.fn() };

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
        { provide: SlotProvider, useValue: mockSlotProvider },
        { provide: AppointmentsService, useValue: mockAppointmentsService },
        PostcodeValidationService,
        { provide: SecurityPipelineService, useValue: mockSecurityPipeline },
        { provide: PatientHistoryService, useValue: { findReturningPatient: jest.fn().mockResolvedValue(null), persistHistory: jest.fn() } },
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
    mockGhlApiService.cancelAppointment.mockResolvedValue(undefined);
    mockGhlApiService.addContactTag.mockResolvedValue(undefined);
    mockGhlApiService.updateContactCustomField.mockResolvedValue(undefined);
    mockConversationsService.updatePhase.mockResolvedValue({});
    mockConversationsService.setContext.mockResolvedValue(undefined);
    mockSlotProvider.getAvailableSlots.mockResolvedValue([]);
    mockAppointmentsService.bookAppointment.mockResolvedValue({ success: true, appointmentId: 'appt_new_001', ghlAppointmentId: 'ghl_new_001', confirmationMessage: 'Appointment confirmed!' });
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

  it('should store the validated postcode in context when an in-area postcode is detected', async () => {
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'My postcode is CF10 1AA' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.setContext).toHaveBeenCalledWith(
      expect.anything(),
      'validatedPostcode',
      'CF10 1AA',
    );
  });

  it('should store the normalised postcode "CF10 1AA" in context when a spaceless postcode "CF101AA" is provided', async () => {
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'CF101AA' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.setContext).toHaveBeenCalledWith(
      expect.anything(),
      'validatedPostcode',
      'CF10 1AA',
    );
  });

  it('should transition phase to "declined" when an out-of-area postcode is provided', async () => {
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'EX4 1AB' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'declined');
    expect(mockConversationsService.setContext).not.toHaveBeenCalled();
  });

  it('should send the static invalid-format message and not change phase when postcode format is invalid', async () => {
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: '12345' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: INVALID_POSTCODE_RESPONSE }),
    );
    expect(mockConversationsService.updatePhase).not.toHaveBeenCalled();
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

  // ── RESCHEDULE intent ──────────────────────────────────────────────────────

  it('should transition phase to "rescheduling" when RESCHEDULE intent detected in booked phase', async () => {
    const bookedConversation = {
      ...mockConversation,
      phase: 'booked',
      context: new Map([
        ['ghlAppointmentId', 'ghl_appt_001'],
        ['appointmentDate', '15 April 2026'],
        ['appointmentTime', '10:00'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(bookedConversation);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'I need to reschedule' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'rescheduling');
  });

  it('should return NO_APPOINTMENT_RESPONSE when RESCHEDULE intent detected but no appointment in context', async () => {
    const bookedNoAppt = { ...mockConversation, phase: 'booked', context: new Map() };
    mockConversationsService.findByGhlContactId.mockResolvedValue(bookedNoAppt);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'I need to reschedule' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: NO_APPOINTMENT_RESPONSE }),
    );
    expect(mockConversationsService.updatePhase).not.toHaveBeenCalled();
  });

  it('should transition phase back to "booked" when CANCEL_RESCHEDULE intent detected', async () => {
    const reschedulingConv = { ...mockConversation, phase: 'rescheduling', context: new Map() };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'never mind, keep my appointment' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.updatePhase).toHaveBeenCalledWith(expect.anything(), 'booked');
  });

  // ── Rescheduling slot flow ─────────────────────────────────────────────────

  it('should fetch available slots when in rescheduling phase with an UNKNOWN message', async () => {
    const reschedulingConv = { ...mockConversation, phase: 'rescheduling', context: new Map() };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    mockSlotProvider.getAvailableSlots.mockResolvedValue([
      { date: '2026-04-20', startTime: '09:00', endTime: '09:30' },
    ]);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'Some time next week' } } as any,
      clinicConfig,
    );
    expect(mockSlotProvider.getAvailableSlots).toHaveBeenCalledWith(clinicConfig.clinicId);
  });

  it('should send FULLY_BOOKED_RESPONSE when no slots are available during rescheduling', async () => {
    const reschedulingConv = { ...mockConversation, phase: 'rescheduling', context: new Map() };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    mockSlotProvider.getAvailableSlots.mockResolvedValue([]);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'Can we move it?' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: "We're fully booked on that date. Would you like to try a different day?" }),
    );
  });

  it('should store offered slots in context when slots are available during rescheduling', async () => {
    const reschedulingConv = { ...mockConversation, phase: 'rescheduling', context: new Map() };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    mockSlotProvider.getAvailableSlots.mockResolvedValue([
      { date: '2026-04-20', startTime: '09:00', endTime: '09:30' },
    ]);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'Some time next week' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.setContext).toHaveBeenCalledWith(
      expect.anything(),
      'reschedulingOfferedSlots',
      expect.any(String),
    );
  });

  it('should cancel the old appointment when a slot is selected from offered slots', async () => {
    const offeredSlots = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const reschedulingConv = {
      ...mockConversation,
      phase: 'rescheduling',
      context: new Map([
        ['reschedulingOfferedSlots', offeredSlots],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'The first one please' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.cancelAppointment).toHaveBeenCalledWith('ghl_old_001');
  });

  it('should book a new appointment after cancelling the old one when a slot is selected', async () => {
    const offeredSlots = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const reschedulingConv = {
      ...mockConversation,
      phase: 'rescheduling',
      context: new Map([
        ['reschedulingOfferedSlots', offeredSlots],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'The first one please' } } as any,
      clinicConfig,
    );
    expect(mockAppointmentsService.bookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: clinicConfig.clinicId, contactId: 'contact_001' }),
    );
  });

  it('should add "rescheduled" tag to the contact after a successful reschedule', async () => {
    const offeredSlots = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const reschedulingConv = {
      ...mockConversation,
      phase: 'rescheduling',
      context: new Map([
        ['reschedulingOfferedSlots', offeredSlots],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'The first one please' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.addContactTag).toHaveBeenCalledWith('contact_001', 'rescheduled');
  });

  it('should update the appointment_date custom field after a successful reschedule', async () => {
    const offeredSlots = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const reschedulingConv = {
      ...mockConversation,
      phase: 'rescheduling',
      context: new Map([
        ['reschedulingOfferedSlots', offeredSlots],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'The first one please' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.updateContactCustomField).toHaveBeenCalledWith(
      'contact_001',
      'appointment_date',
      expect.any(String),
    );
  });

  it('should send the booking confirmation message after a successful reschedule', async () => {
    const offeredSlots = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const reschedulingConv = {
      ...mockConversation,
      phase: 'rescheduling',
      context: new Map([
        ['reschedulingOfferedSlots', offeredSlots],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'The first one please' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Appointment confirmed!' }),
    );
  });

  it('should not book a new appointment when cancelling the old one fails', async () => {
    const offeredSlots = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const reschedulingConv = {
      ...mockConversation,
      phase: 'rescheduling',
      context: new Map([
        ['reschedulingOfferedSlots', offeredSlots],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    mockGhlApiService.cancelAppointment.mockResolvedValue(null);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'The first one please' } } as any,
      clinicConfig,
    );
    expect(mockAppointmentsService.bookAppointment).not.toHaveBeenCalled();
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('issue rescheduling') }),
    );
  });

  it('should respond with an error message when new appointment booking fails after cancellation', async () => {
    const offeredSlots = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const reschedulingConv = {
      ...mockConversation,
      phase: 'rescheduling',
      context: new Map([
        ['reschedulingOfferedSlots', offeredSlots],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    mockAppointmentsService.bookAppointment.mockResolvedValue({ success: false, error: 'Slot taken' });
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'The first one please' } } as any,
      clinicConfig,
    );
    expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('issue booking') }),
    );
  });

  it('should clear the offered slots buffer from context after a successful reschedule', async () => {
    const offeredSlots = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const reschedulingConv = {
      ...mockConversation,
      phase: 'rescheduling',
      context: new Map([
        ['reschedulingOfferedSlots', offeredSlots],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };
    mockConversationsService.findByGhlContactId.mockResolvedValue(reschedulingConv);
    await service.handleInboundMessage(
      { type: 'InboundMessage', location: { id: 'loc_001' }, id: 'contact_001', message: { body: 'The first one please' } } as any,
      clinicConfig,
    );
    expect(mockConversationsService.setContext).toHaveBeenCalledWith(
      expect.anything(),
      'reschedulingOfferedSlots',
      '',
    );
  });
});
