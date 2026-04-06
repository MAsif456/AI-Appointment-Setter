import { isAutoReply } from "./auto-reply-detector";

describe("isAutoReply", () => {
  describe("subject-based detection", () => {
    it('detects "Out of Office" subject', () => {
      expect(isAutoReply({ subject: "Out of Office: John Smith" })).toBe(true);
    });

    it('detects "out of the office" subject', () => {
      expect(
        isAutoReply({ subject: "I am out of the office until Monday" }),
      ).toBe(true);
    });

    it('detects "Automatic reply" subject', () => {
      expect(isAutoReply({ subject: "Automatic reply: Re: Appointment" })).toBe(
        true,
      );
    });

    it('detects "Auto Reply" subject', () => {
      expect(
        isAutoReply({ subject: "Auto Reply: Thanks for your email" }),
      ).toBe(true);
    });

    it('detects "Auto-Reply" with hyphen', () => {
      expect(isAutoReply({ subject: "Auto-Reply" })).toBe(true);
    });

    it('detects "Delivery Status Notification" subject', () => {
      expect(
        isAutoReply({ subject: "Delivery Status Notification (Failure)" }),
      ).toBe(true);
    });

    it('detects "Undeliverable" subject', () => {
      expect(isAutoReply({ subject: "Undeliverable: Your appointment" })).toBe(
        true,
      );
    });

    it('detects "Mail delivery failed" subject', () => {
      expect(isAutoReply({ subject: "Mail delivery failed: returning" })).toBe(
        true,
      );
    });

    it("does NOT detect normal reply subject", () => {
      expect(isAutoReply({ subject: "Re: Your appointment enquiry" })).toBe(
        false,
      );
    });

    it("does NOT detect regular subject", () => {
      expect(isAutoReply({ subject: "I need to book an appointment" })).toBe(
        false,
      );
    });
  });

  describe("sender-based detection", () => {
    it("detects noreply@ sender", () => {
      expect(isAutoReply({ from: "noreply@example.com" })).toBe(true);
    });

    it("detects no-reply@ sender", () => {
      expect(isAutoReply({ from: "no-reply@example.com" })).toBe(true);
    });

    it("detects NOREPLY@ in uppercase", () => {
      expect(isAutoReply({ from: "NOREPLY@clinic.com" })).toBe(true);
    });

    it("detects mailer-daemon@ sender", () => {
      expect(isAutoReply({ from: "mailer-daemon@mail.google.com" })).toBe(true);
    });

    it("detects postmaster@ sender", () => {
      expect(isAutoReply({ from: "postmaster@example.com" })).toBe(true);
    });

    it("does NOT detect normal email sender", () => {
      expect(isAutoReply({ from: "john@gmail.com" })).toBe(false);
    });
  });

  describe("body-based detection", () => {
    it('detects "I am currently out of the office"', () => {
      expect(
        isAutoReply({
          body: "I am currently out of the office until April 10.",
        }),
      ).toBe(true);
    });

    it('detects "I\'m out of the office"', () => {
      expect(
        isAutoReply({ body: "I'm out of the office and will return Monday." }),
      ).toBe(true);
    });

    it('detects "This is an automated response"', () => {
      expect(
        isAutoReply({
          body: "This is an automated response. We received your email.",
        }),
      ).toBe(true);
    });

    it('detects "This is an auto-generated message"', () => {
      expect(isAutoReply({ body: "This is an auto-generated message." })).toBe(
        true,
      );
    });

    it('detects "Do not reply to this email"', () => {
      expect(
        isAutoReply({
          body: "Do not reply to this email. Contact support instead.",
        }),
      ).toBe(true);
    });

    it("does NOT detect normal conversational body", () => {
      expect(isAutoReply({ body: "Yes, Thursday at 2pm works for me." })).toBe(
        false,
      );
    });
  });

  describe("newsletter / bulk-email detection", () => {
    it('detects "unsubscribe from this" footer', () => {
      expect(
        isAutoReply({
          body: "Great deals! Click to unsubscribe from this mailing list.",
        }),
      ).toBe(true);
    });

    it('detects "manage your email preferences" footer', () => {
      expect(
        isAutoReply({ body: "You can manage your email preferences here." }),
      ).toBe(true);
    });

    it('detects "manage your preferences" without "email"', () => {
      expect(
        isAutoReply({ body: "Manage your preferences at any time." }),
      ).toBe(true);
    });

    it('detects "you are receiving this because" footer', () => {
      expect(
        isAutoReply({
          body: "You are receiving this email because you signed up.",
        }),
      ).toBe(true);
    });

    it('detects "you are receiving this message because"', () => {
      expect(
        isAutoReply({
          body: "You are receiving this message because you opted in.",
        }),
      ).toBe(true);
    });

    it('detects "view this email in your browser" header', () => {
      expect(
        isAutoReply({
          body: "View this email in your browser for best results.",
        }),
      ).toBe(true);
    });

    it('detects "view in browser" shorthand', () => {
      expect(isAutoReply({ body: "Having trouble? View in browser." })).toBe(
        true,
      );
    });

    it('detects "click here to unsubscribe"', () => {
      expect(
        isAutoReply({ body: "Click here to unsubscribe from future emails." }),
      ).toBe(true);
    });

    it('detects "opt-out" from mailing list', () => {
      expect(
        isAutoReply({ body: "To opt-out of this mailing list, click below." }),
      ).toBe(true);
    });

    it("does NOT flag normal body that mentions subscribing", () => {
      expect(
        isAutoReply({ body: "I want to subscribe to your newsletter please." }),
      ).toBe(false);
    });

    it("does NOT flag body that mentions a browser", () => {
      expect(
        isAutoReply({
          body: "I opened the link in my browser but it did not work.",
        }),
      ).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false when all fields are undefined", () => {
      expect(isAutoReply({})).toBe(false);
    });

    it("returns false when all fields are empty strings", () => {
      expect(isAutoReply({ subject: "", body: "", from: "" })).toBe(false);
    });

    it("detects auto-reply from combined signals", () => {
      expect(
        isAutoReply({
          subject: "Out of Office",
          from: "noreply@company.com",
          body: "I am currently out of the office.",
        }),
      ).toBe(true);
    });

    it("detects even with only subject present", () => {
      expect(isAutoReply({ subject: "Automatic reply: Thanks" })).toBe(true);
    });
  });
});
