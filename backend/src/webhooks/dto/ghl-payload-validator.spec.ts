import "reflect-metadata";
import { validateGhlPayload } from "./ghl-payload-validator";

describe("validateGhlPayload", () => {
  describe("ContactCreate", () => {
    it("accepts a minimal valid payload", async () => {
      const result = await validateGhlPayload({
        type: "ContactCreate",
        location: { id: "loc_001" },
        first_name: "David",
        phone: "029 2034 5678",
      });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.type).toBe("ContactCreate");
    });

    it("rejects when phone is an injection-style object", async () => {
      const result = await validateGhlPayload({
        type: "ContactCreate",
        location: { id: "loc_001" },
        first_name: "David",
        phone: { $gt: "" },
      });
      expect(result.valid).toBe(false);
      if (!result.valid)
        expect(result.errors.some((e) => e.property === "phone")).toBe(true);
    });

    it("rejects when email is malformed", async () => {
      const result = await validateGhlPayload({
        type: "ContactCreate",
        location: { id: "loc_001" },
        email: "not-an-email",
      });
      expect(result.valid).toBe(false);
    });

    it("rejects when issue exceeds the size cap", async () => {
      const result = await validateGhlPayload({
        type: "ContactCreate",
        location: { id: "loc_001" },
        issue: "a".repeat(1001),
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("InboundMessage", () => {
    it("accepts a minimal valid payload", async () => {
      const result = await validateGhlPayload({
        type: "InboundMessage",
        location: { id: "loc_001" },
        contact_id: "contact_001",
        conversationId: "conv_001",
        message: { body: "Hello", type: "SMS", direction: "inbound" },
      });
      expect(result.valid).toBe(true);
    });

    it("rejects when nested message body exceeds 5000 chars", async () => {
      const result = await validateGhlPayload({
        type: "InboundMessage",
        location: { id: "loc_001" },
        message: { body: "a".repeat(5001) },
      });
      expect(result.valid).toBe(false);
    });

    it("rejects when contact_id is sent as an object", async () => {
      const result = await validateGhlPayload({
        type: "InboundMessage",
        location: { id: "loc_001" },
        contact_id: { $ne: null },
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("Unknown event types", () => {
    it("returns Unknown without raising errors so the service can ignore", async () => {
      const result = await validateGhlPayload({
        type: "SomeFutureGhlEvent",
        location: { id: "loc_001" },
      });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.type).toBe("Unknown");
    });

    it("treats a missing type as Unknown", async () => {
      const result = await validateGhlPayload({ location: { id: "loc_001" } });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.type).toBe("Unknown");
    });
  });
});
