import { stripEmailContent, isEmptyAfterStrip } from "./email-content-stripper";

describe("stripEmailContent", () => {
  it("passes plain text through unchanged", () => {
    expect(stripEmailContent("Hello, I need an appointment")).toBe(
      "Hello, I need an appointment",
    );
  });

  it("returns empty string for empty/whitespace input", () => {
    expect(stripEmailContent("")).toBe("");
    expect(stripEmailContent("   ")).toBe("");
    expect(stripEmailContent(null as any)).toBe("");
  });

  it("strips HTML tags and preserves text", () => {
    const html = "<div><p>Hello <strong>there</strong></p></div>";
    expect(stripEmailContent(html)).toBe("Hello there");
  });

  it("converts <br> and block-level closings to newlines", () => {
    const html = "Line one<br>Line two<br/>Line three";
    const result = stripEmailContent(html);
    expect(result).toContain("Line one");
    expect(result).toContain("Line two");
    expect(result).toContain("Line three");
  });

  it("decodes HTML entities", () => {
    const html = "Tom &amp; Jerry &lt;friends&gt; said &quot;hi&quot;";
    expect(stripEmailContent(html)).toBe('Tom & Jerry <friends> said "hi"');
  });

  it("removes <style> and <script> blocks entirely", () => {
    const html =
      '<style>.foo { color: red; }</style><p>Visible</p><script>alert("x")</script>';
    expect(stripEmailContent(html)).toBe("Visible");
  });

  it("strips quoted reply chains (On ... wrote:)", () => {
    const html = [
      "Yes, I can come Thursday.",
      "",
      "On Mon, 31 Mar 2026 at 10:00, Reception <clinic@example.com> wrote:",
      "> We have slots on Thursday. Would you like to book?",
    ].join("\n");

    const result = stripEmailContent(html);
    expect(result).toContain("Yes, I can come Thursday");
    expect(result).not.toContain("We have slots");
  });

  it("strips ------Original Message------ blocks", () => {
    const html = [
      "Sounds good, thanks.",
      "",
      "------Original Message------",
      "From: Reception",
      "Sent: Monday",
      "Previous content here",
    ].join("\n");

    const result = stripEmailContent(html);
    expect(result).toContain("Sounds good");
    expect(result).not.toContain("Previous content");
  });

  it("strips email signatures (-- delimiter)", () => {
    const html = [
      "I would like to reschedule please.",
      "",
      "--",
      "John Smith",
      "john@example.com",
    ].join("\n");

    const result = stripEmailContent(html);
    expect(result).toContain("reschedule");
    expect(result).not.toContain("john@example.com");
  });

  it('strips "Sent from my iPhone" footers', () => {
    const html = "Yes please\n\nSent from my iPhone";
    const result = stripEmailContent(html);
    expect(result).toContain("Yes please");
    expect(result).not.toContain("iPhone");
  });

  it("handles complex nested HTML from Gmail", () => {
    const html = [
      '<div dir="ltr">',
      '<div style="font-family:arial">I need a morning slot please.</div>',
      "</div>",
      '<div class="gmail_quote">',
      "<div>On Tue, 1 Apr wrote:<br></div>",
      "<blockquote><div>We have availability.</div></blockquote>",
      "</div>",
    ].join("");

    const result = stripEmailContent(html);
    expect(result).toContain("morning slot");
    expect(result).not.toContain("We have availability");
  });

  it("collapses excessive newlines", () => {
    const html = "Line one\n\n\n\n\nLine two";
    const result = stripEmailContent(html);
    expect(result).toBe("Line one\n\nLine two");
  });

  it("handles malformed HTML without crashing", () => {
    const malformed = "<div><p>Unclosed <b>tags <i>everywhere";
    expect(() => stripEmailContent(malformed)).not.toThrow();
    expect(stripEmailContent(malformed)).toContain("Unclosed");
  });
});

describe("isEmptyAfterStrip", () => {
  it("returns true for empty string", () => {
    expect(isEmptyAfterStrip("")).toBe(true);
  });

  it("returns true for whitespace-only string", () => {
    expect(isEmptyAfterStrip("   \n\t  ")).toBe(true);
  });

  it("returns false for non-empty content", () => {
    expect(isEmptyAfterStrip("Hello")).toBe(false);
  });

  it("returns true for null/undefined", () => {
    expect(isEmptyAfterStrip(null as any)).toBe(true);
    expect(isEmptyAfterStrip(undefined as any)).toBe(true);
  });
});
