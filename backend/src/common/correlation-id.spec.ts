import { generateCorrelationId } from "./correlation-id";

describe("generateCorrelationId", () => {
  it("should return a valid UUID string", () => {
    const id = generateCorrelationId();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it("should return unique IDs on each call", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => generateCorrelationId()),
    );
    expect(ids.size).toBe(50);
  });
});
