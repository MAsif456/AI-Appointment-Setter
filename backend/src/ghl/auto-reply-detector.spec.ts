import { isAutoReply } from './auto-reply-detector';

describe('isAutoReply', () => {
  describe('subject-based detection', () => {
    it('detects "Out of Office" subject', () => {
      expect(isAutoReply({ subject: 'Out of Office: John Smith' })).toBe(true);
    });

    it('detects "out of the office" subject', () => {
      expect(isAutoReply({ subject: 'I am out of the office until Monday' })).toBe(true);
    });

    it('detects "Automatic reply" subject', () => {
      expect(isAutoReply({ subject: 'Automatic reply: Re: Appointment' })).toBe(true);
    });

    it('detects "Auto Reply" subject', () => {
      expect(isAutoReply({ subject: 'Auto Reply: Thanks for your email' })).toBe(true);
    });

    it('detects "Auto-Reply" with hyphen', () => {
      expect(isAutoReply({ subject: 'Auto-Reply' })).toBe(true);
    });

    it('detects "Delivery Status Notification" subject', () => {
      expect(
        isAutoReply({ subject: 'Delivery Status Notification (Failure)' }),
      ).toBe(true);
    });

    it('detects "Undeliverable" subject', () => {
      expect(isAutoReply({ subject: 'Undeliverable: Your appointment' })).toBe(true);
    });

    it('detects "Mail delivery failed" subject', () => {
      expect(isAutoReply({ subject: 'Mail delivery failed: returning' })).toBe(true);
    });

    it('does NOT detect normal reply subject', () => {
      expect(isAutoReply({ subject: 'Re: Your appointment enquiry' })).toBe(false);
    });

    it('does NOT detect regular subject', () => {
      expect(isAutoReply({ subject: 'I need to book an appointment' })).toBe(false);
    });
  });

  describe('sender-based detection', () => {
    it('detects noreply@ sender', () => {
      expect(isAutoReply({ from: 'noreply@example.com' })).toBe(true);
    });

    it('detects no-reply@ sender', () => {
      expect(isAutoReply({ from: 'no-reply@example.com' })).toBe(true);
    });

    it('detects NOREPLY@ in uppercase', () => {
      expect(isAutoReply({ from: 'NOREPLY@clinic.com' })).toBe(true);
    });

    it('detects mailer-daemon@ sender', () => {
      expect(isAutoReply({ from: 'mailer-daemon@mail.google.com' })).toBe(true);
    });

    it('detects postmaster@ sender', () => {
      expect(isAutoReply({ from: 'postmaster@example.com' })).toBe(true);
    });

    it('does NOT detect normal email sender', () => {
      expect(isAutoReply({ from: 'john@gmail.com' })).toBe(false);
    });
  });

  describe('body-based detection', () => {
    it('detects "I am currently out of the office"', () => {
      expect(
        isAutoReply({ body: 'I am currently out of the office until April 10.' }),
      ).toBe(true);
    });

    it('detects "I\'m out of the office"', () => {
      expect(
        isAutoReply({ body: "I'm out of the office and will return Monday." }),
      ).toBe(true);
    });

    it('detects "This is an automated response"', () => {
      expect(
        isAutoReply({ body: 'This is an automated response. We received your email.' }),
      ).toBe(true);
    });

    it('detects "This is an auto-generated message"', () => {
      expect(
        isAutoReply({ body: 'This is an auto-generated message.' }),
      ).toBe(true);
    });

    it('detects "Do not reply to this email"', () => {
      expect(
        isAutoReply({ body: 'Do not reply to this email. Contact support instead.' }),
      ).toBe(true);
    });

    it('does NOT detect normal conversational body', () => {
      expect(
        isAutoReply({ body: 'Yes, Thursday at 2pm works for me.' }),
      ).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false when all fields are undefined', () => {
      expect(isAutoReply({})).toBe(false);
    });

    it('returns false when all fields are empty strings', () => {
      expect(isAutoReply({ subject: '', body: '', from: '' })).toBe(false);
    });

    it('detects auto-reply from combined signals', () => {
      expect(
        isAutoReply({
          subject: 'Out of Office',
          from: 'noreply@company.com',
          body: 'I am currently out of the office.',
        }),
      ).toBe(true);
    });

    it('detects even with only subject present', () => {
      expect(isAutoReply({ subject: 'Automatic reply: Thanks' })).toBe(true);
    });
  });
});
