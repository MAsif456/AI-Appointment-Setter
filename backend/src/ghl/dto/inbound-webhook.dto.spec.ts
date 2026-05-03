import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { InboundWebhookDto } from "./inbound-webhook.dto";

/** Returns a structurally-valid payload that callers can mutate per test. */
function validPayload(): Record<string, unknown> {
  return {
    type: "InboundMessage",
    locationId: "loc_001",
    contactId: "contact_001",
    conversationId: "conv_001",
    messageId: "msg_001",
    body: "Hello, I would like to book.",
    direction: "inbound",
    messageType: "SMS",
  };
}

/** Pipes a payload through plainToInstance + validate. */
async function check(payload: Record<string, unknown>) {
  return validate(plainToInstance(InboundWebhookDto, payload));
}

describe("InboundWebhookDto", () => {
  it("accepts a fully-valid InboundMessage payload", async () => {
    expect(await check(validPayload())).toHaveLength(0);
  });

  it("rejects a payload missing required fields", async () => {
    const errors = await check({ type: "InboundMessage" });
    const properties = errors.map((e) => e.property);
    expect(properties).toEqual(
      expect.arrayContaining([
        "locationId",
        "contactId",
        "conversationId",
        "messageId",
        "body",
        "direction",
        "messageType",
      ]),
    );
  });

  it("rejects a body longer than 5000 characters", async () => {
    const errors = await check({ ...validPayload(), body: "a".repeat(5001) });
    expect(errors.find((e) => e.property === "body")?.constraints).toHaveProperty(
      "maxLength",
    );
  });

  it.each(["sideways", "INBOUND", "", "outbound "])(
    "rejects an unknown direction value: %p",
    async (direction) => {
      const errors = await check({ ...validPayload(), direction });
      expect(
        errors.find((e) => e.property === "direction"),
      ).toBeDefined();
    },
  );

  it.each(["sms", "Voicemail", "", "Pigeon"])(
    "rejects an unsupported messageType: %p",
    async (messageType) => {
      const errors = await check({ ...validPayload(), messageType });
      expect(
        errors.find((e) => e.property === "messageType"),
      ).toBeDefined();
    },
  );

  it.each(["SMS", "WhatsApp", "Email", "FB", "IG", "Live_Chat", "Live Chat"])(
    "accepts known messageType: %p",
    async (messageType) => {
      expect(await check({ ...validPayload(), messageType })).toHaveLength(0);
    },
  );

  it("rejects a non-string contactId (NoSQL operator injection)", async () => {
    const errors = await check({ ...validPayload(), contactId: { $gt: "" } });
    expect(errors.find((e) => e.property === "contactId")).toBeDefined();
  });

  it("rejects a type other than 'InboundMessage'", async () => {
    const errors = await check({ ...validPayload(), type: "ContactCreate" });
    expect(errors.find((e) => e.property === "type")).toBeDefined();
  });

  it("rejects identifiers exceeding the 100-char ceiling", async () => {
    const errors = await check({
      ...validPayload(),
      contactId: "x".repeat(101),
    });
    expect(
      errors.find((e) => e.property === "contactId")?.constraints,
    ).toHaveProperty("maxLength");
  });
});
