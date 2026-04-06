import {
  escapeHtml,
  formatEmailHtml,
  formatEmailSubject,
} from "./email-formatter";

describe("escapeHtml", () => {
  it('escapes & < > "', () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot;",
    );
  });

  it("leaves normal text unchanged", () => {
    expect(escapeHtml("Hello there")).toBe("Hello there");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("formatEmailHtml", () => {
  it("wraps plain text in HTML with inline styles", () => {
    const result = formatEmailHtml("Hello!", "Cardiff Physio");
    expect(result).toContain("font-family:Arial");
    expect(result).toContain("Hello!");
    expect(result).toContain("Cardiff Physio");
  });

  it("converts newlines to <br>", () => {
    const result = formatEmailHtml("Line 1\nLine 2", "Clinic");
    expect(result).toContain("Line 1<br>Line 2");
  });

  it("escapes HTML special characters in AI response", () => {
    const result = formatEmailHtml('Use <code> & "quotes"', "Clinic");
    expect(result).toContain("&lt;code&gt;");
    expect(result).toContain("&amp;");
    expect(result).toContain("&quot;quotes&quot;");
    expect(result).not.toContain("<code>");
  });

  it("escapes clinic name in footer", () => {
    const result = formatEmailHtml("Hi", "Tom & Jerry's Clinic");
    expect(result).toContain("Tom &amp; Jerry");
  });

  it("produces valid HTML structure for empty input", () => {
    const result = formatEmailHtml("", "Clinic");
    expect(result).toContain("<div");
    expect(result).toContain("</div>");
  });

  it("formats multi-paragraph text correctly", () => {
    const result = formatEmailHtml("Para 1\n\nPara 2", "Clinic");
    expect(result).toContain("Para 1<br><br>Para 2");
  });
});

describe("formatEmailSubject", () => {
  it("returns subject without Re: for first message", () => {
    const result = formatEmailSubject("Cardiff Physio", true);
    expect(result).toBe("Cardiff Physio - Your appointment enquiry");
    expect(result).not.toMatch(/^Re:/);
  });

  it("returns subject with Re: for subsequent messages", () => {
    const result = formatEmailSubject("Cardiff Physio", false);
    expect(result).toBe("Re: Cardiff Physio - Your appointment enquiry");
  });

  it("includes clinic name in the subject", () => {
    const result = formatEmailSubject("My Custom Clinic", true);
    expect(result).toContain("My Custom Clinic");
  });
});
