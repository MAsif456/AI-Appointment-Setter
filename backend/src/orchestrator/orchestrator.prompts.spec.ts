import {
  normalisePostcode,
  mapMessageTypeToChannel,
  channelToMessageType,
  getResponseCharLimit,
  buildSingleTurnPrompt,
  buildMultiTurnSystemPrompt,
} from "./orchestrator.prompts";
import { OrchestratorContext } from "./orchestrator.types";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";

const baseContext: OrchestratorContext = {
  clinicId: "507f1f77bcf86cd799439013",
  phase: "qualifying",
  messages: [],
  patientInfo: { firstName: "Alice", issue: "Back pain" },
  isReturningPatient: false,
  channel: "sms",
};

const clinicConfig: ClinicConfig = {
  clinicId: "507f1f77bcf86cd799439013",
  name: "Cardiff Physio",
  tone: "Friendly",
  serviceAreas: ["CF", "NP"],
  ghlLocationId: "loc_001",
  isActive: true,
};

describe("normalisePostcode", () => {
  it("normalises lowercase spaceless postcode", () => {
    expect(normalisePostcode("cf101aa")).toBe("CF10 1AA");
  });

  it("preserves already-normalised postcode", () => {
    expect(normalisePostcode("CF10 1AA")).toBe("CF10 1AA");
  });

  it("handles extra spaces", () => {
    expect(normalisePostcode("CF10  1AA")).toBe("CF10 1AA");
  });

  it("handles short outward code", () => {
    expect(normalisePostcode("E1 6AN")).toBe("E1 6AN");
  });
});

describe("mapMessageTypeToChannel", () => {
  it.each([
    ["SMS", "sms"],
    ["WhatsApp", "whatsapp"],
    ["FB", "facebook"],
    ["IG", "instagram"],
    ["Email", "email"],
    ["Live_Chat", "website"],
    ["Live Chat", "website"],
  ])('maps "%s" to "%s"', (input, expected) => {
    expect(mapMessageTypeToChannel(input)).toBe(expected);
  });

  it('defaults unknown types to "sms"', () => {
    expect(mapMessageTypeToChannel("Carrier Pigeon")).toBe("sms");
  });

  it('defaults empty string to "sms"', () => {
    expect(mapMessageTypeToChannel("")).toBe("sms");
  });
});

describe("channelToMessageType", () => {
  it.each([
    ["sms", "SMS"],
    ["whatsapp", "WhatsApp"],
    ["email", "Email"],
    ["website", "Live_Chat"],
  ])('maps "%s" to "%s"', (input, expected) => {
    expect(channelToMessageType(input)).toBe(expected);
  });

  it('defaults unknown channels to "SMS"', () => {
    expect(channelToMessageType("unknown")).toBe("SMS");
  });
});

describe("getResponseCharLimit", () => {
  it("returns 500 for email channel", () => {
    expect(getResponseCharLimit("email")).toBe(500);
  });

  it("returns 160 for sms channel", () => {
    expect(getResponseCharLimit("sms")).toBe(160);
  });

  it("returns 160 when channel is undefined", () => {
    expect(getResponseCharLimit(undefined)).toBe(160);
  });

  it("returns 160 for non-email channels", () => {
    expect(getResponseCharLimit("whatsapp")).toBe(160);
  });
});

describe("buildSingleTurnPrompt", () => {
  it("includes clinic name", () => {
    const prompt = buildSingleTurnPrompt(
      "Test situation",
      baseContext,
      clinicConfig,
    );
    expect(prompt).toContain("Cardiff Physio");
  });

  it("includes situation context", () => {
    const prompt = buildSingleTurnPrompt(
      "The patient asked for a slot",
      baseContext,
      clinicConfig,
    );
    expect(prompt).toContain("The patient asked for a slot");
  });

  it("includes security boundary", () => {
    const prompt = buildSingleTurnPrompt("context", baseContext, clinicConfig);
    expect(prompt).toContain("SECURITY BOUNDARY");
    expect(prompt).toContain("<user_message>");
  });

  it('includes patient name when not "there"', () => {
    const prompt = buildSingleTurnPrompt("context", baseContext, clinicConfig);
    expect(prompt).toContain("Alice");
  });

  it('omits patient name section when firstName is "there"', () => {
    const ctx = { ...baseContext, patientInfo: { firstName: "there" } };
    const prompt = buildSingleTurnPrompt("context", ctx, clinicConfig);
    expect(prompt).not.toContain("Patient name: there");
  });

  it("uses professional tone when configured", () => {
    const config = { ...clinicConfig, tone: "Professional" as const };
    const prompt = buildSingleTurnPrompt("context", baseContext, config);
    expect(prompt).toContain("formal");
  });

  it("applies email character limit for email channel", () => {
    const prompt = buildSingleTurnPrompt(
      "context",
      baseContext,
      clinicConfig,
      "email",
    );
    expect(prompt).toContain("500 characters");
  });

  it("applies SMS character limit by default", () => {
    const prompt = buildSingleTurnPrompt("context", baseContext, clinicConfig);
    expect(prompt).toContain("160 characters");
  });

  it("includes custom instructions when configured", () => {
    const config = {
      ...clinicConfig,
      customInstructions: "Always mention parking",
    };
    const prompt = buildSingleTurnPrompt("context", baseContext, config);
    expect(prompt).toContain("Always mention parking");
  });
});

describe("buildMultiTurnSystemPrompt", () => {
  it("includes staged conversation flow instructions (STAGE 1 or STAGE 3)", () => {
    const prompt = buildMultiTurnSystemPrompt(baseContext, clinicConfig);
    // buildSystemPrompt includes STAGE instructions — at least one should be present
    expect(prompt).toMatch(/STAGE [1-5]/);
  });

  it("includes patient name from context", () => {
    const prompt = buildMultiTurnSystemPrompt(baseContext, clinicConfig);
    expect(prompt).toContain("Alice");
  });

  it("includes patient issue when available", () => {
    const prompt = buildMultiTurnSystemPrompt(baseContext, clinicConfig);
    expect(prompt).toContain("Back pain");
  });

  it("includes clinic name", () => {
    const prompt = buildMultiTurnSystemPrompt(baseContext, clinicConfig);
    expect(prompt).toContain("Cardiff Physio");
  });

  it("includes security boundary", () => {
    const prompt = buildMultiTurnSystemPrompt(baseContext, clinicConfig);
    expect(prompt).toContain("SECURITY BOUNDARY");
  });

  it("appends email character limit for email channel", () => {
    const prompt = buildMultiTurnSystemPrompt(
      baseContext,
      clinicConfig,
      "email",
    );
    expect(prompt).toContain("500 characters");
  });

  it("appends SMS character limit for sms channel", () => {
    const prompt = buildMultiTurnSystemPrompt(baseContext, clinicConfig, "sms");
    expect(prompt).toContain("160 characters");
  });

  it('uses "there" as default when patientInfo firstName is missing', () => {
    const ctx = {
      ...baseContext,
      patientInfo: { firstName: undefined as any },
    };
    const prompt = buildMultiTurnSystemPrompt(ctx, clinicConfig);
    expect(prompt).toContain("there");
  });

  it("includes returning patient context when isReturningPatient is true", () => {
    const ctx = { ...baseContext, isReturningPatient: true };
    const prompt = buildMultiTurnSystemPrompt(ctx, clinicConfig);
    expect(prompt).toContain("returning");
  });

  it("includes custom instructions when clinic has them", () => {
    const config = {
      ...clinicConfig,
      customInstructions: "Mention free parking",
    };
    const prompt = buildMultiTurnSystemPrompt(baseContext, config);
    expect(prompt).toContain("Mention free parking");
  });

  it("includes CONVERSATION FLOW section", () => {
    const prompt = buildMultiTurnSystemPrompt(baseContext, clinicConfig);
    expect(prompt).toContain("CONVERSATION FLOW");
  });
});
