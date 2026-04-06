import {
  EmailChannelAdapter,
  SmsChannelAdapter,
  getChannelAdapter,
} from "./channel-adapter";

describe("EmailChannelAdapter", () => {
  const adapter = new EmailChannelAdapter();

  describe("formatOutbound", () => {
    it("returns html and subject for first message (no Re: prefix)", () => {
      const result = adapter.formatOutbound("Hello!", "Cardiff Physio", true);
      expect(result.html).toContain("Hello!");
      expect(result.html).toContain("font-family");
      expect(result.subject).toBe("Cardiff Physio - Your appointment enquiry");
      expect(result.subject).not.toMatch(/^Re:/);
    });

    it("returns html and subject with Re: prefix for subsequent messages", () => {
      const result = adapter.formatOutbound(
        "Follow up",
        "Cardiff Physio",
        false,
      );
      expect(result.html).toContain("Follow up");
      expect(result.subject).toBe(
        "Re: Cardiff Physio - Your appointment enquiry",
      );
    });

    it("escapes HTML special characters in the response text", () => {
      const result = adapter.formatOutbound(
        '<script>alert("xss")</script>',
        "Clinic",
        true,
      );
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("includes clinic name in the footer", () => {
      const result = adapter.formatOutbound("Hi", "My Clinic", true);
      expect(result.html).toContain("My Clinic");
    });
  });

  describe("stripInbound", () => {
    it("strips HTML tags from email content", () => {
      const result = adapter.stripInbound("<p>Hello there</p>");
      expect(result).toContain("Hello there");
      expect(result).not.toContain("<p>");
    });

    it("returns empty string for empty input", () => {
      expect(adapter.stripInbound("")).toBe("");
    });

    it("returns empty string for whitespace-only input", () => {
      expect(adapter.stripInbound("   ")).toBe("");
    });
  });

  describe("isEmptyAfterStrip", () => {
    it("returns true for empty string", () => {
      expect(adapter.isEmptyAfterStrip("")).toBe(true);
    });

    it("returns true for whitespace-only string", () => {
      expect(adapter.isEmptyAfterStrip("   ")).toBe(true);
    });

    it("returns false for string with content", () => {
      expect(adapter.isEmptyAfterStrip("hello")).toBe(false);
    });
  });

  describe("isAutoReply", () => {
    it("detects out-of-office subjects", () => {
      expect(adapter.isAutoReply({ subject: "Out of Office" })).toBe(true);
    });

    it("detects noreply senders", () => {
      expect(adapter.isAutoReply({ from: "noreply@example.com" })).toBe(true);
    });

    it("detects auto-reply body patterns", () => {
      expect(
        adapter.isAutoReply({ body: "This is an automated response." }),
      ).toBe(true);
    });

    it("detects newsletter unsubscribe patterns", () => {
      expect(
        adapter.isAutoReply({
          body: "Click here to unsubscribe from this mailing list",
        }),
      ).toBe(true);
    });

    it("returns false for normal email content", () => {
      expect(
        adapter.isAutoReply({
          subject: "Re: Appointment",
          body: "Yes, 2pm works.",
          from: "john@gmail.com",
        }),
      ).toBe(false);
    });

    it("returns false when all fields are empty", () => {
      expect(adapter.isAutoReply({})).toBe(false);
    });
  });
});

describe("SmsChannelAdapter", () => {
  const adapter = new SmsChannelAdapter();

  describe("formatOutbound", () => {
    it("returns empty object (no html or subject for SMS)", () => {
      const result = adapter.formatOutbound("Hello!", "Clinic", true);
      expect(result).toEqual({});
    });
  });

  describe("stripInbound", () => {
    it("returns the raw message unchanged", () => {
      expect(adapter.stripInbound("Hello <world>")).toBe("Hello <world>");
    });
  });

  describe("isEmptyAfterStrip", () => {
    it("always returns false (SMS messages are never stripped empty)", () => {
      expect(adapter.isEmptyAfterStrip("")).toBe(false);
      expect(adapter.isEmptyAfterStrip("hello")).toBe(false);
    });
  });

  describe("isAutoReply", () => {
    it("always returns false (auto-reply detection is email-only)", () => {
      expect(adapter.isAutoReply({ subject: "Out of Office" })).toBe(false);
    });
  });
});

describe("getChannelAdapter", () => {
  it('returns EmailChannelAdapter for "email" channel', () => {
    const adapter = getChannelAdapter("email");
    expect(adapter).toBeInstanceOf(EmailChannelAdapter);
  });

  it('returns SmsChannelAdapter for "sms" channel', () => {
    const adapter = getChannelAdapter("sms");
    expect(adapter).toBeInstanceOf(SmsChannelAdapter);
  });

  it("returns SmsChannelAdapter for unknown channel strings", () => {
    const adapter = getChannelAdapter("carrier-pigeon");
    expect(adapter).toBeInstanceOf(SmsChannelAdapter);
  });

  it('returns SmsChannelAdapter for "whatsapp" channel', () => {
    const adapter = getChannelAdapter("whatsapp");
    expect(adapter).toBeInstanceOf(SmsChannelAdapter);
  });

  it("returns SmsChannelAdapter for empty string", () => {
    const adapter = getChannelAdapter("");
    expect(adapter).toBeInstanceOf(SmsChannelAdapter);
  });
});
