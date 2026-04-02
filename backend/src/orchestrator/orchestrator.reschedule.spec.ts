/**
 * Unit tests for handleReschedulingSlotFlow and executeReschedule.
 *
 * Covers:
 *   - No previously offered slots → fetches slots, stores them in context, returns AI response
 *   - No slots available → returns FULLY_BOOKED_RESPONSE
 *   - Previously offered slots exist + lead selects one → executeReschedule
 *   - executeReschedule: cancels old appointment, books new, adds tag, updates field, clears buffer
 *   - Cancellation failure → returns retry message, does not book new appointment
 *   - New booking failure → returns error message
 *   - Non-critical GHL failures (tag/custom-field) do not abort the reschedule
 */
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { handleReschedulingSlotFlow, FULLY_BOOKED_RESPONSE, RescheduleDeps } from './orchestrator.reschedule';
import { OrchestratorContext } from './orchestrator.types';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const clinicConfig: ClinicConfig = {
  clinicId: '507f1f77bcf86cd799439013',
  name: 'Cardiff Physio',
  tone: 'Friendly',
  serviceAreas: ['CF'],
  ghlLocationId: 'loc_001',
  isActive: true,
};

const conversationId = new Types.ObjectId('507f1f77bcf86cd799439011');
const leadId = new Types.ObjectId('507f1f77bcf86cd799439012');

const baseConversation: any = {
  _id: conversationId,
  leadId,
  phase: 'rescheduling',
  context: new Map<string, string>(),
};

const baseContext: OrchestratorContext = {
  ghlContactId: 'contact_001',
  clinicId: clinicConfig.clinicId,
  phase: 'rescheduling',
  messages: [],
  patientInfo: { firstName: 'there' },
};

const mockSlot = { date: '2026-04-20', startTime: '09:00', endTime: '09:30' };

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDeps(overrides: Partial<RescheduleDeps> = {}): RescheduleDeps {
  return {
    slotProvider: { getAvailableSlots: jest.fn().mockResolvedValue([mockSlot]) } as any,
    groqService: { generateResponse: jest.fn().mockResolvedValue('Here are some slots for you.') } as any,
    ghlApiService: {
      cancelAppointment: jest.fn().mockResolvedValue(undefined),
      addContactTag: jest.fn().mockResolvedValue(undefined),
      updateContactCustomField: jest.fn().mockResolvedValue(undefined),
    } as any,
    conversationsService: {
      setContext: jest.fn().mockResolvedValue(undefined),
      updatePhase: jest.fn().mockResolvedValue(undefined),
    } as any,
    appointmentsService: {
      bookAppointment: jest.fn().mockResolvedValue({
        success: true,
        appointmentId: 'appt_new_001',
        ghlAppointmentId: 'ghl_new_001',
        confirmationMessage: 'Appointment confirmed!',
      }),
    } as any,
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleReschedulingSlotFlow', () => {
  describe('no previously offered slots', () => {
    it('should fetch slots from SlotProvider', async () => {
      const deps = buildDeps();
      await handleReschedulingSlotFlow('next week please', baseConversation, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.slotProvider.getAvailableSlots).toHaveBeenCalledWith(clinicConfig.clinicId);
    });

    it('should return FULLY_BOOKED_RESPONSE when no slots are available', async () => {
      const deps = buildDeps({ slotProvider: { getAvailableSlots: jest.fn().mockResolvedValue([]) } as any });
      const result = await handleReschedulingSlotFlow('next week', baseConversation, 'contact_001', baseContext, clinicConfig, deps);
      expect(result.response).toBe(FULLY_BOOKED_RESPONSE);
      expect(result.completedReschedule).toBe(false);
    });

    it('should store offered slots in context when slots are available', async () => {
      const deps = buildDeps();
      await handleReschedulingSlotFlow('any time next week', baseConversation, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.conversationsService.setContext).toHaveBeenCalledWith(
        conversationId,
        'reschedulingOfferedSlots',
        expect.any(String),
      );
    });

    it('should return the AI-generated slot-offer response', async () => {
      const deps = buildDeps();
      const result = await handleReschedulingSlotFlow('any time', baseConversation, 'contact_001', baseContext, clinicConfig, deps);
      expect(result.response).toBe('Here are some slots for you.');
      expect(result.completedReschedule).toBe(false);
    });

    it('should return FULLY_BOOKED_RESPONSE when the AI returns null for the slot-offer message', async () => {
      const deps = buildDeps({ groqService: { generateResponse: jest.fn().mockResolvedValue(null) } as any });
      const result = await handleReschedulingSlotFlow('any time', baseConversation, 'contact_001', baseContext, clinicConfig, deps);
      expect(result.response).toBe(FULLY_BOOKED_RESPONSE);
    });
  });

  describe('previously offered slots — no match', () => {
    it('should fetch new slots when offered slots exist but the reply does not match', async () => {
      const offered = JSON.stringify([{ dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' }]);
      const conv = { ...baseConversation, context: new Map([['reschedulingOfferedSlots', offered]]) };
      const deps = buildDeps();
      await handleReschedulingSlotFlow('actually how about Thursday instead', conv, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.slotProvider.getAvailableSlots).toHaveBeenCalled();
    });
  });

  describe('slot selected — executeReschedule', () => {
    const offered = JSON.stringify([
      { dateTime: '2026-04-20T09:00:00.000Z', displayText: 'Monday 20th April at 9am' },
    ]);
    const convWithSlots = {
      ...baseConversation,
      context: new Map<string, string>([
        ['reschedulingOfferedSlots', offered],
        ['ghlAppointmentId', 'ghl_old_001'],
      ]),
    };

    it('should cancel the old GHL appointment', async () => {
      const deps = buildDeps();
      await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.ghlApiService.cancelAppointment).toHaveBeenCalledWith('ghl_old_001');
    });

    it('should book the new appointment after successful cancellation', async () => {
      const deps = buildDeps();
      await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.appointmentsService.bookAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId: clinicConfig.clinicId,
          contactId: 'contact_001',
          startTime: '2026-04-20T09:00:00.000Z',
        }),
      );
    });

    it('should add the "rescheduled" tag to the contact', async () => {
      const deps = buildDeps();
      await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.ghlApiService.addContactTag).toHaveBeenCalledWith('contact_001', 'rescheduled');
    });

    it('should update the appointment_date custom field', async () => {
      const deps = buildDeps();
      await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.ghlApiService.updateContactCustomField).toHaveBeenCalledWith(
        'contact_001',
        'appointment_date',
        expect.any(String),
      );
    });

    it('should clear the offered slots buffer from context', async () => {
      const deps = buildDeps();
      await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.conversationsService.setContext).toHaveBeenCalledWith(
        conversationId,
        'reschedulingOfferedSlots',
        '',
      );
    });

    it('should return the booking confirmation message and completedReschedule: true', async () => {
      const deps = buildDeps();
      const result = await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(result.completedReschedule).toBe(true);
      expect(result.response).toBe('Appointment confirmed!');
    });

    it('should return a fallback confirmation when bookAppointment returns no confirmationMessage', async () => {
      const deps = buildDeps({
        appointmentsService: {
          bookAppointment: jest.fn().mockResolvedValue({
            success: true,
            appointmentId: 'appt_new_001',
            ghlAppointmentId: 'ghl_new_001',
          }),
        } as any,
      });
      const result = await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(result.completedReschedule).toBe(true);
      expect(result.response).toContain('rescheduled');
    });

    it('should not book when cancellation fails and should return a retry message', async () => {
      const deps = buildDeps({
        ghlApiService: {
          cancelAppointment: jest.fn().mockResolvedValue(null),
          addContactTag: jest.fn(),
          updateContactCustomField: jest.fn(),
        } as any,
      });
      const result = await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.appointmentsService.bookAppointment).not.toHaveBeenCalled();
      expect(result.completedReschedule).toBe(false);
      expect(result.response).toContain('issue rescheduling');
    });

    it('should return an error message when bookAppointment fails after successful cancellation', async () => {
      const deps = buildDeps({
        appointmentsService: {
          bookAppointment: jest.fn().mockResolvedValue({ success: false, error: 'Slot taken' }),
        } as any,
      });
      const result = await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(result.completedReschedule).toBe(false);
      expect(result.response).toContain('issue booking');
    });

    it('should still complete the reschedule even if adding the tag returns null', async () => {
      const deps = buildDeps({
        ghlApiService: {
          cancelAppointment: jest.fn().mockResolvedValue(undefined),
          addContactTag: jest.fn().mockResolvedValue(null),
          updateContactCustomField: jest.fn().mockResolvedValue(undefined),
        } as any,
      });
      const result = await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(result.completedReschedule).toBe(true);
    });

    it('should still complete the reschedule even if updating the custom field throws', async () => {
      const deps = buildDeps({
        ghlApiService: {
          cancelAppointment: jest.fn().mockResolvedValue(undefined),
          addContactTag: jest.fn().mockResolvedValue(undefined),
          updateContactCustomField: jest.fn().mockRejectedValue(new Error('Field error')),
        } as any,
      });
      const result = await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(result.completedReschedule).toBe(true);
    });
  });
});
