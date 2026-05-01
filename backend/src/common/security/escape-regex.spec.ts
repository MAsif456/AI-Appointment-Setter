import { escapeRegex } from "./escape-regex";

describe("escapeRegex", () => {
  it("returns plain alphanumeric input unchanged", () => {
    expect(escapeRegex("Cardiff")).toBe("Cardiff");
    expect(escapeRegex("CF10 1AA")).toBe("CF10 1AA");
  });

  it.each([
    [".", "\\."],
    ["*", "\\*"],
    ["+", "\\+"],
    ["?", "\\?"],
    ["^", "\\^"],
    ["$", "\\$"],
    ["{", "\\{"],
    ["}", "\\}"],
    ["(", "\\("],
    [")", "\\)"],
    ["|", "\\|"],
    ["[", "\\["],
    ["]", "\\]"],
    ["\\", "\\\\"],
  ])("escapes the metacharacter %p to %p", (input, expected) => {
    expect(escapeRegex(input)).toBe(expected);
  });

  it("escapes a typical NoSQL/ReDoS attack string", () => {
    // .* would match every clinic without escaping
    expect(escapeRegex(".*")).toBe("\\.\\*");
    // Catastrophic-backtracking pattern — must not survive
    expect(escapeRegex("(a+)+")).toBe("\\(a\\+\\)\\+");
  });

  it("produces a literal-only RegExp when fed back into the constructor", () => {
    const literal = ".*";
    const safe = new RegExp(escapeRegex(literal));
    expect(safe.test(".*")).toBe(true);
    expect(safe.test("anything")).toBe(false);
  });

  it("returns an empty string for non-string inputs", () => {
    expect(escapeRegex(null as unknown as string)).toBe("");
    expect(escapeRegex(undefined as unknown as string)).toBe("");
    expect(escapeRegex({ $gt: "" } as unknown as string)).toBe("");
  });
});
