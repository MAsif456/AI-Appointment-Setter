import { Logger } from '@nestjs/common';
import { handleBooking } from './conversations.booking.handler';

describe('handleBooking', () => {
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let appointmentsService: { bookAppointment: jest.Mock };

  const baseConversation = {
    _id: 'conv123',
    ghlContactId: 'conv_contact_123',
  } as any;

  const baseClinic = { _id: 'clinic123' } as any;

  const baseLead = {
    _id: 'lead123',
    ghlContactId: 'lead_contact_456',
  } as any;

  const baseSelectionResult = {
    selectedSlot: { dateTime: new Date('2026-04-06T14:00:00Z') },
  } as any;

  beforeEach(() => {
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    appointmentsService = { bookAppointment: jest.fn() };
  });

  /** Covers lines 33-35 — no contactId on lead or conversation */
  it('should return failure and warn when no GHL contact ID is available', async () => {
    const leadNoContact = { _id: 'lead123', ghlContactId: undefined } as any;
    const convNoContact = { _id: 'conv123', ghlContactId: undefined } as any;

    const result = await handleBooking(
      convNoContact,
      baseClinic,
      leadNoContact,
      baseSelectionResult,
      appointmentsService as any,
      logger as unknown as Logger,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('No GHL contact ID available for this lead');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No GHL contact ID'),
    );
    expect(appointmentsService.bookAppointment).not.toHaveBeenCalled();
  });

  /** Covers lines 49-50 — result.success true → logger.log */
  it('should log success message when booking succeeds', async () => {
    appointmentsService.bookAppointment.mockResolvedValue({
      success: true,
      appointmentId: 'appt123',
    });

    const result = await handleBooking(
      baseConversation,
      baseClinic,
      baseLead,
      baseSelectionResult,
      appointmentsService as any,
      logger as unknown as Logger,
    );

    expect(result.success).toBe(true);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Auto-booked appointment appt123'),
    );
  });

  /** Covers lines 50-51 — result.slotTaken true → logger.warn */
  it('should log warning when slot is taken during auto-booking', async () => {
    appointmentsService.bookAppointment.mockResolvedValue({
      success: false,
      slotTaken: true,
      error: 'Slot no longer available',
    });

    const result = await handleBooking(
      baseConversation,
      baseClinic,
      baseLead,
      baseSelectionResult,
      appointmentsService as any,
      logger as unknown as Logger,
    );

    expect(result.slotTaken).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Slot was taken during auto-booking'),
    );
  });

  /** Covers lines 55-56 — unexpected throw → catch → error log */
  it('should catch unexpected errors and return failure', async () => {
    appointmentsService.bookAppointment.mockRejectedValue(new Error('DB timeout'));

    const result = await handleBooking(
      baseConversation,
      baseClinic,
      baseLead,
      baseSelectionResult,
      appointmentsService as any,
      logger as unknown as Logger,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Booking failed unexpectedly');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Auto-booking failed: DB timeout'),
    );
  });

  it('should prefer lead.ghlContactId over conversation.ghlContactId', async () => {
    appointmentsService.bookAppointment.mockResolvedValue({ success: true, appointmentId: 'a1' });

    await handleBooking(
      baseConversation,
      baseClinic,
      baseLead,
      baseSelectionResult,
      appointmentsService as any,
      logger as unknown as Logger,
    );

    expect(appointmentsService.bookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'lead_contact_456' }),
    );
  });

  it('should fall back to conversation.ghlContactId when lead has none', async () => {
    const leadNoContact = { _id: 'lead123', ghlContactId: undefined } as any;
    appointmentsService.bookAppointment.mockResolvedValue({ success: true, appointmentId: 'a1' });

    await handleBooking(
      baseConversation,
      baseClinic,
      leadNoContact,
      baseSelectionResult,
      appointmentsService as any,
      logger as unknown as Logger,
    );

    expect(appointmentsService.bookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'conv_contact_123' }),
    );
  });
});
