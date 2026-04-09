import {
  generateReminderMessage,
  generateReminderEmailHtml,
} from './reminder.handler';

describe('Reminder Handlers', () => {
  describe('generateReminderMessage', () => {
    const mockAppointment = {
      appointmentDate: new Date('2026-04-06T14:00:00Z'),
      appointmentTime: '14:00',
    } as any;

    const mockClinic = {
      name: 'Cardiff Chiropractic',
      address: '123 Queen Street, Cardiff',
    } as any;

    it('should generate 1-hour reminder', () => {
      const message = generateReminderMessage(mockAppointment, mockClinic, 1);

      expect(message).toContain('in 1 hour');
      expect(message).toContain('Cardiff Chiropractic');
      expect(message).toContain('123 Queen Street');
    });

    it('should generate 24-hour reminder with full details', () => {
      const message = generateReminderMessage(mockAppointment, mockClinic, 24);

      expect(message).toContain('Reminder:');
      expect(message).toContain('tomorrow');
      expect(message).toContain('14:00');
      expect(message).toContain('Cardiff Chiropractic');
      expect(message).toContain('123 Queen Street');
      expect(message).toContain('Reply if you need to reschedule or cancel');
    });

    it('should generate 48-hour reminder', () => {
      const message = generateReminderMessage(mockAppointment, mockClinic, 48);

      expect(message).toContain('Upcoming appointment');
      expect(message).toContain('Cardiff Chiropractic');
      expect(message).toContain('123 Queen Street');
    });

    it('should use British English date formatting', () => {
      const message = generateReminderMessage(mockAppointment, mockClinic, 24);

      // Should be "Sunday 6th April" not "04/06/2026"
      expect(message).toMatch(/\d+(st|nd|rd|th)\s+(January|February|March|April|May|June|July|August|September|October|November|December)/);
    });

    it('should handle missing clinic address gracefully', () => {
      const clinicNoAddress = {
        name: 'Test Clinic',
        address: undefined,
      } as any;

      const message = generateReminderMessage(
        mockAppointment,
        clinicNoAddress,
        24,
      );

      expect(message).toContain('the clinic');
    });

    it('should generate custom interval reminder with daysUntil === 0 (uses "soon")', () => {
    const msg = generateReminderMessage(mockAppointment, mockClinic, 6);
    expect(msg).toContain('soon');
    expect(msg).toContain('Cardiff Chiropractic');
    });

    it('should generate custom interval reminder with daysUntil === 1 (singular "day")', () => {
    const msg = generateReminderMessage(mockAppointment, mockClinic, 36);
    expect(msg).toContain('in 1 day');
    expect(msg).not.toContain('days');
    });

    it('should generate custom interval reminder with daysUntil > 1 (plural "days")', () => {
    const msg = generateReminderMessage(mockAppointment, mockClinic, 72);
    expect(msg).toContain('in 3 days');
    });
  });

  describe('generateReminderEmailHtml', () => {
    const mockAppointment = {
      appointmentDate: new Date('2026-04-06T14:00:00Z'),
      appointmentTime: '14:00',
    } as any;

    const mockClinic = {
      name: 'Cardiff Chiropractic',
      address: '123 Queen Street, Cardiff',
      phone: '02920 123456',
    } as any;

    it('should return valid HTML containing clinic name and appointment details', () => {
      const html = generateReminderEmailHtml(mockAppointment, mockClinic, 24);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Cardiff Chiropractic');
      expect(html).toContain('14:00');
      expect(html).toContain('6th April 2026');
    });

    it('should use "1 hour" urgency line when hoursBeforeAppointment === 1', () => {
      const html = generateReminderEmailHtml(mockAppointment, mockClinic, 1);
      expect(html).toContain('1 hour');
    });

    it('should use "tomorrow" urgency line when hoursBeforeAppointment === 24', () => {
      const html = generateReminderEmailHtml(mockAppointment, mockClinic, 24);
      expect(html).toContain('tomorrow');
    });

    it('should use "in 2 days" urgency line when hoursBeforeAppointment === 48', () => {
      const html = generateReminderEmailHtml(mockAppointment, mockClinic, 48);
      expect(html).toContain('in 2 days');
    });

    it('should use plural "days" for custom interval > 48h', () => {
      const html = generateReminderEmailHtml(mockAppointment, mockClinic, 72);
      expect(html).toContain('in 3 days');
    });

    it('should use singular "day" when daysUntil === 1 (custom interval 36h)', () => {
      const html = generateReminderEmailHtml(mockAppointment, mockClinic, 36);
      expect(html).toContain('in 1 day');
      expect(html).not.toMatch(/in 1 days/);
    });

    it('should include clinic address when present', () => {
      const html = generateReminderEmailHtml(mockAppointment, mockClinic, 24);
      expect(html).toContain('123 Queen Street, Cardiff');
    });

    it('should omit address row when clinic address is empty', () => {
      const clinicNoAddress = { name: 'Test Clinic', address: '' } as any;
      const html = generateReminderEmailHtml(mockAppointment, clinicNoAddress, 24);
      expect(html).not.toContain('📍');
    });

    it('should include phone number when clinic has one', () => {
      const html = generateReminderEmailHtml(mockAppointment, mockClinic, 24);
      expect(html).toContain('02920 123456');
    });

    it('should omit phone line when clinic has no phone', () => {
      const clinicNoPhone = { name: 'Test Clinic', address: '1 Street' } as any;
      const html = generateReminderEmailHtml(mockAppointment, clinicNoPhone, 24);
      expect(html).not.toContain('Call us on');
    });
  });

});