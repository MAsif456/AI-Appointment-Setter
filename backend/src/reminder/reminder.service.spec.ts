import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReminderService } from './reminder.service';
import { Appointment } from '../database/schemas/appointment.schema';
import { Conversation } from '../database/schemas/conversation.schema';
import { Clinic } from '../database/schemas/clinic.schema';
import { GhlApiService } from '../ghl/ghl-api.service';
import { ReminderTrackerService } from './reminder-tracker.service';
import { InboxNotificationService } from '../notifications/inbox-notification.service';
import { EncryptionService } from '../common/encryption/encryption.service';

/** Shared 15-min window helpers — keeps tests readable */
const makeAppointmentInWindow = (intervalHours: number) => {
  const now = new Date();
  // Place appointment at interval - 0.1 hours → within [interval-0.25, interval]
  return new Date(now.getTime() + (intervalHours - 0.1) * 60 * 60 * 1000);
};

const makeAppointmentOutsideWindow = (intervalHours: number) => {
  const now = new Date();
  // Place appointment 2 hours beyond the interval → outside window
  return new Date(now.getTime() + (intervalHours + 2) * 60 * 60 * 1000);
};

describe('ReminderService', () => {
  let service: ReminderService;

  const mockAppointmentModel = { find: jest.fn(), updateOne: jest.fn() };
  const mockConversationModel = { findOne: jest.fn() };
  const mockClinicModel = { findById: jest.fn() };
  const mockGhlApiService = { sendMessageWithRetry: jest.fn() };
  const mockReminderTrackerService = { trackSent: jest.fn(), trackFailed: jest.fn() };
  const mockInboxNotificationService = { createForClinicStaff: jest.fn().mockResolvedValue(undefined) };

  /** Reusable factory for a clinic with enabled reminders */
  const makeClinic = (reminderTimes = [24, 1]) => ({
    _id: 'clinic123',
    name: 'Test Clinic',
    address: '123 Test St',
    reminderSettings: { enabled: true, reminderTimes },
  });

  /** Reusable factory for a conversation */
  const makeConversation = (channel: 'sms' | 'whatsapp' | 'facebook' | 'instagram' | 'email' = 'sms') => ({
    _id: 'conv123',
    ghlContactId: 'contact123',
    ghlConversationId: 'ghl_conv_123',
    channel,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: getModelToken(Appointment.name), useValue: mockAppointmentModel },
        { provide: getModelToken(Conversation.name), useValue: mockConversationModel },
        { provide: getModelToken(Clinic.name), useValue: mockClinicModel },
        { provide: GhlApiService, useValue: mockGhlApiService },
        { provide: ReminderTrackerService, useValue: mockReminderTrackerService },
        { provide: InboxNotificationService, useValue: mockInboxNotificationService },
        { provide: EncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn().mockReturnValue('') } },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // findAppointmentsNeedingReminders
  // ---------------------------------------------------------------------------
  describe('findAppointmentsNeedingReminders', () => {
    const mockFind = (appointments: unknown[]) =>
      mockAppointmentModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(appointments),
        }),
      });

    it('should query only confirmed future appointments', async () => {
      mockFind([]);
      await service.findAppointmentsNeedingReminders();

      expect(mockAppointmentModel.find).toHaveBeenCalledWith({
        status: 'confirmed',
        appointmentDate: { $gt: expect.any(Date) },
      });
    });

    it('should skip clinics with disabled reminders', async () => {
      mockFind([{
        _id: 'appt1',
        appointmentDate: makeAppointmentInWindow(24),
        status: 'confirmed',
        reminders: [],
        clinicId: { reminderSettings: { enabled: false, reminderTimes: [24] } },
      }]);

      const result = await service.findAppointmentsNeedingReminders();
      expect(result).toHaveLength(0);
    });

    /**
     * Covers line 62 — the `if (!clinic?.reminderSettings?.enabled) continue` path
     * when clinicId is null after populate.
     */
    it('should skip appointments with null clinicId', async () => {
      mockFind([{
        _id: 'appt1',
        appointmentDate: makeAppointmentInWindow(24),
        status: 'confirmed',
        reminders: [],
        clinicId: null,
      }]);

      const result = await service.findAppointmentsNeedingReminders();
      expect(result).toHaveLength(0);
    });

    /**
     * Covers needingReminders.push — the check.send === true path.
     * Uses an appointment timed within the 15-min window.
     */
    it('should include appointment whose time falls within the reminder window', async () => {
      mockFind([{
        _id: 'appt1',
        appointmentDate: makeAppointmentInWindow(24),
        status: 'confirmed',
        reminders: [],
        clinicId: makeClinic([24]),
      }]);

      const result = await service.findAppointmentsNeedingReminders();
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('appt1');
    });

    /**
     * Covers the alreadySent duplicate-prevention guard — reminder already sent
     * means shouldSendReminder returns false → not pushed.
     */
    it('should not include appointment where reminder was already sent', async () => {
      mockFind([{
        _id: 'appt1',
        appointmentDate: makeAppointmentInWindow(24),
        status: 'confirmed',
        reminders: [{ type: '24_hour', status: 'sent' }],
        clinicId: makeClinic([24]),
      }]);

      const result = await service.findAppointmentsNeedingReminders();
      expect(result).toHaveLength(0);
    });

    it('should not include appointment outside reminder window', async () => {
      mockFind([{
        _id: 'appt1',
        appointmentDate: makeAppointmentOutsideWindow(24),
        status: 'confirmed',
        reminders: [],
        clinicId: makeClinic([24]),
      }]);

      const result = await service.findAppointmentsNeedingReminders();
      expect(result).toHaveLength(0);
    });

    it('should handle appointments with undefined reminders array', async () => {
      mockFind([{
        _id: 'appt1',
        appointmentDate: makeAppointmentInWindow(1),
        status: 'confirmed',
        reminders: undefined, // AC: edge case — no reminders array yet
        clinicId: makeClinic([1]),
      }]);

      // Should not throw — reminder.some() must handle undefined gracefully
      await expect(service.findAppointmentsNeedingReminders()).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // sendReminder
  // ---------------------------------------------------------------------------
  describe('sendReminder', () => {
    const baseAppointment = {
      _id: 'appt123',
      appointmentDate: new Date('2026-04-06T14:00:00Z'),
      appointmentTime: '14:00',
      clinicId: 'clinic123',
      leadId: 'lead123',
    } as any;

    const mockConvFind = (conv: unknown) =>
      mockConversationModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(conv) }),
      });

    const mockClinicFind = (clinic: unknown) =>
      mockClinicModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(clinic) });

    it('should send SMS and track success', async () => {
      mockConvFind(makeConversation('sms'));
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry.mockResolvedValue(undefined);
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      const result = await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(result).toBe(true);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'SMS',
          contactId: 'contact123',
          conversationId: 'ghl_conv_123',
          message: expect.stringContaining('Reminder:'),
        }),
      );
      expect(mockReminderTrackerService.trackSent).toHaveBeenCalled();
    });

    it('should send WhatsApp when conversation channel is whatsapp', async () => {
      mockConvFind(makeConversation('whatsapp'));
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry.mockResolvedValue(undefined);
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      await service.sendReminder(baseAppointment, '1_hour', 1);

      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: 'WhatsApp', conversationId: 'ghl_conv_123' }),
      );
    });

    it('should send FB when conversation channel is facebook', async () => {
      mockConvFind(makeConversation('facebook'));
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry.mockResolvedValue(undefined);
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: 'FB', conversationId: 'ghl_conv_123' }),
      );
    });

    it('should send IG when conversation channel is instagram', async () => {
      mockConvFind(makeConversation('instagram'));
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry.mockResolvedValue(undefined);
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: 'IG', conversationId: 'ghl_conv_123' }),
      );
    });

    /** Covers the missing ghlContactId early-return guard */
    it('should return false when ghlContactId is missing', async () => {
      mockConvFind({ _id: 'conv123', ghlContactId: undefined, channel: 'sms' });

      const result = await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(result).toBe(false);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    /** Covers lines 92-101 — conversation is null entirely */
    it('should return false when conversation document is null', async () => {
      mockConvFind(null);

      const result = await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(result).toBe(false);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    /** Covers lines 135-136 — clinic not found after conversation lookup */
    it('should return false when clinic document is not found', async () => {
      mockConvFind(makeConversation('sms'));
      mockClinicFind(null); // clinic not in DB

      const result = await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(result).toBe(false);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalled();
    });

    it('should return false and track failure when all channels fail', async () => {
      const convNoEmail = { ...makeConversation('sms'), leadId: { _id: 'lead123' } };
      mockConvFind(convNoEmail);
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry.mockRejectedValue(new Error('422'));
      mockReminderTrackerService.trackFailed.mockResolvedValue(undefined);

      const result = await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(result).toBe(false);
      expect(mockReminderTrackerService.trackFailed).toHaveBeenCalledWith(baseAppointment, '24_hour');
    });

    it('should succeed via email when primary channel (SMS) fails', async () => {
      const convWithEmail = {
        ...makeConversation('sms'),
        leadId: { _id: 'lead123', email: 'patient@example.com' },
      };
      mockConvFind(convWithEmail);
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry
        .mockRejectedValueOnce(Object.assign(new Error('Missing phone number'), { response: { status: 422, data: { message: 'Missing phone number' } } }))
        .mockResolvedValueOnce(undefined); // email succeeds
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      const result = await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(result).toBe(true);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledTimes(2);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: 'Email', subject: expect.stringContaining('Test Clinic') }),
      );
      expect(mockReminderTrackerService.trackSent).toHaveBeenCalled();
    });

    it('should only send the primary channel (not email) when primary channel succeeds and lead has an email', async () => {
      const convWithLeadEmail = {
        ...makeConversation('sms'),
        leadId: { _id: 'lead123', email: 'patient@example.com' },
      };
      mockConvFind(convWithLeadEmail);
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry.mockResolvedValue(undefined);
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      const result = await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(result).toBe(true);
      // Email is only sent as a fallback when the primary channel fails — not additionally.
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledTimes(1);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: 'SMS' }),
      );
    });

    it('should still succeed and return true when email send fails but SMS succeeded', async () => {
      const convWithLeadEmail = {
        ...makeConversation('sms'),
        leadId: { _id: 'lead123', email: 'patient@example.com' },
      };
      mockConvFind(convWithLeadEmail);
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Email 422'));
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      const result = await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(result).toBe(true);
      expect(mockReminderTrackerService.trackSent).toHaveBeenCalled();
    });

    it('should not send email when lead has no email address', async () => {
      const convWithLeadNoEmail = {
        ...makeConversation('sms'),
        leadId: { _id: 'lead123' },
      };
      mockConvFind(convWithLeadNoEmail);
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry.mockResolvedValue(undefined);
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledTimes(1);
      expect(mockGhlApiService.sendMessageWithRetry).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'Email' }),
      );
    });

    it('should only send email once when channel is email (no duplicate)', async () => {
      const convEmailChannel = {
        ...makeConversation('email'),
        leadId: { _id: 'lead123', email: 'patient@example.com' },
      };
      mockConvFind(convEmailChannel);
      mockClinicFind(makeClinic());
      mockGhlApiService.sendMessageWithRetry.mockResolvedValue(undefined);
      mockReminderTrackerService.trackSent.mockResolvedValue(undefined);

      await service.sendReminder(baseAppointment, '24_hour', 24);

      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledTimes(1);
      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: 'Email' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // processReminders
  // ---------------------------------------------------------------------------
  describe('processReminders', () => {
    /** Covers lines 246-264 — the null clinic guard inside processReminders loop */
    it('should skip and not send when appointment has null clinic', async () => {
      const appts = [{
        _id: 'appt1',
        appointmentDate: makeAppointmentInWindow(24),
        clinicId: null,
        reminders: [],
      }] as any;

      jest.spyOn(service, 'findAppointmentsNeedingReminders').mockResolvedValue(appts);
      const spy = jest.spyOn(service, 'sendReminder');

      const result = await service.processReminders();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    });

    /**
     * Covers check.send === false path inside processReminders —
     * appointment returned by findAppointmentsNeedingReminders but
     * shouldSendReminder returns false (e.g. timing drifted between calls).
     */
    it('should not call sendReminder when shouldSendReminder returns false', async () => {
      const appts = [{
        _id: 'appt1',
        appointmentDate: makeAppointmentOutsideWindow(24),
        clinicId: { reminderSettings: { enabled: true, reminderTimes: [24] } },
        reminders: [],
      }] as any;

      jest.spyOn(service, 'findAppointmentsNeedingReminders').mockResolvedValue(appts);
      const spy = jest.spyOn(service, 'sendReminder');

      const result = await service.processReminders();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    });

    /** Covers sent++ branch */
    it('should increment sent count when sendReminder succeeds', async () => {
      const appts = [{
        _id: 'appt1',
        appointmentDate: makeAppointmentInWindow(24),
        clinicId: { reminderSettings: { enabled: true, reminderTimes: [24] } },
        reminders: [],
      }] as any;

      jest.spyOn(service, 'findAppointmentsNeedingReminders').mockResolvedValue(appts);
      jest.spyOn(service, 'sendReminder').mockResolvedValue(true);

      const result = await service.processReminders();

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });

    /** Covers failed++ branch */
    it('should increment failed count when sendReminder returns false', async () => {
      const appts = [{
        _id: 'appt1',
        appointmentDate: makeAppointmentInWindow(24),
        clinicId: { reminderSettings: { enabled: true, reminderTimes: [24] } },
        reminders: [],
      }] as any;

      jest.spyOn(service, 'findAppointmentsNeedingReminders').mockResolvedValue(appts);
      jest.spyOn(service, 'sendReminder').mockResolvedValue(false);

      const result = await service.processReminders();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should correctly tally mixed success and failure results', async () => {
      const appts = [
        {
          _id: 'appt1',
          appointmentDate: makeAppointmentInWindow(24),
          clinicId: { reminderSettings: { enabled: true, reminderTimes: [24] } },
          reminders: [],
        },
        {
          _id: 'appt2',
          appointmentDate: makeAppointmentInWindow(1),
          clinicId: { reminderSettings: { enabled: true, reminderTimes: [1] } },
          reminders: [],
        },
      ] as any;

      jest.spyOn(service, 'findAppointmentsNeedingReminders').mockResolvedValue(appts);
      jest.spyOn(service, 'sendReminder')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await service.processReminders();

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should return zeros when no appointments need reminders', async () => {
      jest.spyOn(service, 'findAppointmentsNeedingReminders').mockResolvedValue([]);

      const result = await service.processReminders();

      expect(result).toEqual({ sent: 0, failed: 0 });
    });
  });
});