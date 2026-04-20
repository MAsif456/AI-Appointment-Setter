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

    it('should offer same-day remaining slots plus 3 slots on one other day', async () => {
      const sameDayBefore = { date: '2026-04-20', startTime: '09:00', endTime: '09:30' };
      const sameDayAfter1 = { date: '2026-04-20', startTime: '09:30', endTime: '10:00' };
      const sameDayAfter2 = { date: '2026-04-20', startTime: '10:30', endTime: '11:00' };
      const otherDay1 = { date: '2026-04-21', startTime: '09:00', endTime: '09:30' };
      const otherDay2 = { date: '2026-04-21', startTime: '10:00', endTime: '10:30' };
      const otherDay3 = { date: '2026-04-21', startTime: '11:00', endTime: '11:30' };
      const otherDay4 = { date: '2026-04-21', startTime: '12:00', endTime: '12:30' };
      const deps = buildDeps({
        slotProvider: {
          getAvailableSlots: jest
            .fn()
            .mockResolvedValue([sameDayBefore, sameDayAfter1, sameDayAfter2, otherDay1, otherDay2, otherDay3, otherDay4]),
        } as any,
      });
      const contextWithAppt: OrchestratorContext = {
        ...baseContext,
        currentAppointment: {
          ghlAppointmentId: 'ghl_old',
          appointmentDate: 'Monday 20th April',
          appointmentTime: '9:20am',
          startTime: '2026-04-20T10:00:00.000Z',
        },
      };
      await handleReschedulingSlotFlow('next week please', baseConversation, 'contact_001', contextWithAppt, clinicConfig, deps);
      const offered = JSON.parse((deps.conversationsService.setContext as jest.Mock).mock.calls[0][2]);
      const offeredDisplayText = offered.map((s: any) => s.displayText);
      expect(offeredDisplayText).toContain('Monday 20th April at 9:30am');
      expect(offeredDisplayText).toContain('Monday 20th April at 10:30am');
      expect(offeredDisplayText).not.toContain('Monday 20th April at 9am');
      const offeredDateTimes = offered.map((s: any) => new Date(s.dateTime).toISOString());
      const otherDayCount = offeredDateTimes.filter((iso: string) => iso.startsWith('2026-04-21')).length;
      expect(otherDayCount).toBe(3);
    });

    it('should offer same-day slots using British date fallback when startTime is absent', async () => {
      const sameDaySlot = { date: '2026-04-09', startTime: '12:00', endTime: '12:30' };
      const otherSlot  = { date: '2026-04-10', startTime: '09:00', endTime: '09:30' };
      const deps = buildDeps({
        slotProvider: { getAvailableSlots: jest.fn().mockResolvedValue([sameDaySlot, otherSlot]) } as any,
      });
      const contextWithBritishDate: OrchestratorContext = {
        ...baseContext,
        currentAppointment: {
          ghlAppointmentId: 'ghl_old',
          appointmentDate: 'Thursday 9th April',
          appointmentTime: '11:20 AM',
          // no startTime — simulates appointment booked before startTime was persisted
        },
      };
      await handleReschedulingSlotFlow('next week please', baseConversation, 'contact_001', contextWithBritishDate, clinicConfig, deps);
      const offered = JSON.parse((deps.conversationsService.setContext as jest.Mock).mock.calls[0][2]);
      const dates = offered.map((s: any) => new Date(s.dateTime).toISOString().split('T')[0]);
      expect(dates).toContain('2026-04-09');
      expect(dates).toContain('2026-04-10');
    });

    it('should include all slots when no startTime is set on the current appointment', async () => {
      const slot1 = { date: '2026-04-20', startTime: '09:00', endTime: '09:30' };
      const slot2 = { date: '2026-04-21', startTime: '09:00', endTime: '09:30' };
      const deps = buildDeps({
        slotProvider: { getAvailableSlots: jest.fn().mockResolvedValue([slot1, slot2]) } as any,
      });
      await handleReschedulingSlotFlow('next week please', baseConversation, 'contact_001', baseContext, clinicConfig, deps);
      const offered = JSON.parse((deps.conversationsService.setContext as jest.Mock).mock.calls[0][2]);
      expect(offered.length).toBeGreaterThanOrEqual(1);
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
      expect(deps.ghlApiService.cancelAppointment).toHaveBeenCalledWith(expect.any(String), 'ghl_old_001');
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
      expect(deps.ghlApiService.addContactTag).toHaveBeenCalledWith(expect.any(String), 'contact_001', 'rescheduled');
    });

    it('should update the appointment_date custom field', async () => {
      const deps = buildDeps();
      await handleReschedulingSlotFlow('The first one please', convWithSlots, 'contact_001', baseContext, clinicConfig, deps);
      expect(deps.ghlApiService.updateContactCustomField).toHaveBeenCalledWith(
        expect.any(String),
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
