import {
  generateReminderMessage,
  isReminderResponse,
  detectRescheduleIntent,
  detectCancelIntent,
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

  describe('isReminderResponse', () => {
    it('should detect response to system reminder', () => {
      const recentMessages = [
        { sender: 'system', content: 'Reminder: Your appointment is tomorrow' },
      ];

      const result = isReminderResponse('I need to reschedule', recentMessages);

      expect(result).toBe(true);
    });

    it('should not detect reminder response when last message is not from system', () => {
      const recentMessages = [
        { sender: 'ai', content: 'How can I help you?' },
      ];

      const result = isReminderResponse('I need to reschedule', recentMessages);

      expect(result).toBe(false);
    });

    it('should handle empty message history', () => {
      const result = isReminderResponse('I need to reschedule', []);

      expect(result).toBe(false);
    });
  });

  describe('detectRescheduleIntent', () => {
    it('should detect "reschedule" keyword', () => {
      expect(detectRescheduleIntent('I need to reschedule')).toBe(true);
      expect(detectRescheduleIntent('Can I re-schedule?')).toBe(true);
      expect(detectRescheduleIntent('I want to rebook')).toBe(true);
    });

    it('should detect "change" phrases', () => {
      expect(detectRescheduleIntent('I need to change my appointment')).toBe(true);
      expect(detectRescheduleIntent('Can I move my booking?')).toBe(true);
    });

    it('should detect "can\'t make it" phrases', () => {
      expect(detectRescheduleIntent("I can't make it")).toBe(true);
      expect(detectRescheduleIntent("I cant make it")).toBe(true);
    });

    it('should detect "different time" phrases', () => {
      expect(detectRescheduleIntent('I need a different time')).toBe(true);
      expect(detectRescheduleIntent('Do you have another date?')).toBe(true);
    });

    it('should not detect unrelated messages', () => {
      expect(detectRescheduleIntent('Thank you')).toBe(false);
      expect(detectRescheduleIntent('See you tomorrow')).toBe(false);
    });
    
    it('should detect response when last system message contains lowercase reminder', () => {
    const recentMessages = [
        { sender: 'system', content: 'Upcoming reminder for your appointment tomorrow' },
    ];
    expect(isReminderResponse('I need to cancel', recentMessages)).toBe(true);
    });
  });

  describe('detectCancelIntent', () => {
    it('should detect "cancel" keyword', () => {
      expect(detectCancelIntent('I need to cancel')).toBe(true);
      expect(detectCancelIntent('Please cancel my appointment')).toBe(true);
    });

    it('should detect "can\'t come" phrases', () => {
      expect(detectCancelIntent("I can't come")).toBe(true);
      expect(detectCancelIntent("I can't attend")).toBe(true);
    });

    it('should detect "not coming" phrases', () => {
      expect(detectCancelIntent("I'm not coming")).toBe(true);
      expect(detectCancelIntent("not coming anymore")).toBe(true);
    });

    it('should detect "won\'t make it" phrases', () => {
      expect(detectCancelIntent("I won't make it")).toBe(true);
      expect(detectCancelIntent("wont make it")).toBe(true);
    });

    it('should not detect unrelated messages', () => {
      expect(detectCancelIntent('Thank you')).toBe(false);
      expect(detectCancelIntent('I need to reschedule')).toBe(false);
    });
  });
});