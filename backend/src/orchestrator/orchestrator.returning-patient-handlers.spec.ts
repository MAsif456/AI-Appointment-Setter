/**
 * Unit tests for orchestrator.returning-patient-handlers.ts
 *
 * Verifies that both static handler functions return SMS-friendly strings
 * that are under 160 characters and do not mention any AI technology.
 */
import {
  handleDetailsUnchanged,
  handleDetailsChanged,
} from "./orchestrator.returning-patient-handlers";

describe("orchestrator returning patient handlers", () => {
  describe("handleDetailsUnchanged", () => {
    it("returns a non-empty string", () => {
      expect(handleDetailsUnchanged()).toBeTruthy();
    });

    it("returns a string under 160 characters for SMS compatibility", () => {
      expect(handleDetailsUnchanged().length).toBeLessThanOrEqual(160);
    });

    it("does not mention any AI technology", () => {
      const response = handleDetailsUnchanged().toLowerCase();
      expect(response).not.toContain("groq");
      expect(response).not.toContain("llama");
      expect(response).not.toContain("chatgpt");
      expect(response).not.toContain("openai");
    });

    it("returns a consistent value on repeated calls", () => {
      expect(handleDetailsUnchanged()).toBe(handleDetailsUnchanged());
    });
  });

  describe("handleDetailsChanged", () => {
    it("returns a non-empty string", () => {
      expect(handleDetailsChanged()).toBeTruthy();
    });

    it("returns a string under 160 characters for SMS compatibility", () => {
      expect(handleDetailsChanged().length).toBeLessThanOrEqual(160);
    });

    it("does not mention any AI technology", () => {
      const response = handleDetailsChanged().toLowerCase();
      expect(response).not.toContain("groq");
      expect(response).not.toContain("llama");
      expect(response).not.toContain("chatgpt");
      expect(response).not.toContain("openai");
    });

    it("asks for a postcode", () => {
      expect(handleDetailsChanged().toLowerCase()).toContain("postcode");
    });

    it("returns a consistent value on repeated calls", () => {
      expect(handleDetailsChanged()).toBe(handleDetailsChanged());
    });
  });
});
