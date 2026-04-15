import { buildContextFromDb } from "./context-builder";

/**
 * Builds a minimal fake lead document for testing.
 * @param overrides - Optional field overrides
 */
function makeLead(overrides: Partial<any> = {}): any {
  return {
    firstName: "Sarah",
    lastName: "Williams",
    email: "sarah@email.com",
    phone: "07700900123",
    issue: "Back pain",
    leadSource: "facebook",
    ...overrides,
  };
}

/**
 * Builds a minimal fake clinic document for testing.
 * @param overrides - Optional field overrides
 */
function makeClinic(overrides: Partial<any> = {}): any {
  return {
    _id: { toString: () => "clinic123" },
    name: "Cardiff Physiotherapy Centre",
    ghlLocationId: "loc123",
    isActive: true,
    serviceAreas: [{ postcodePrefix: "CF" }, { postcodePrefix: "NP" }],
    aiConfig: {
      tone: "friendly",
      greetingTemplate: "Hello {{firstName}}!",
      customInstructions: "Always mention free parking",
    },
    ...overrides,
  };
}

/** Unit tests for buildContextFromDb (context-builder.ts) */
describe("buildContextFromDb", () => {
  // LeadInfo must contain exactly what the AI layer expects
  describe("leadInfo", () => {
    it("should map lead fields to LeadInfo correctly", () => {
      const { leadInfo } = buildContextFromDb(makeLead(), makeClinic());
      expect(leadInfo.firstName).toBe("Sarah");
      expect(leadInfo.lastName).toBe("Williams");
      expect(leadInfo.email).toBe("sarah@email.com");
      expect(leadInfo.phone).toBe("07700900123");
      expect(leadInfo.issue).toBe("Back pain");
      expect(leadInfo.leadSource).toBe("facebook");
    });
  });

  // ClinicConfig must contain exactly what the AI layer expects
  describe("clinicConfig", () => {
    it("should map clinic fields to ClinicConfig correctly", () => {
      const { clinicConfig } = buildContextFromDb(makeLead(), makeClinic());
      expect(clinicConfig.clinicId).toBe("clinic123");
      expect(clinicConfig.name).toBe("Cardiff Physiotherapy Centre");
      expect(clinicConfig.ghlLocationId).toBe("loc123");
      expect(clinicConfig.isActive).toBe(true);
    });

    it("should extract postcode prefixes from serviceAreas", () => {
      const { clinicConfig } = buildContextFromDb(makeLead(), makeClinic());
      expect(clinicConfig.serviceAreas).toEqual(["CF", "NP"]);
    });

    it("should return empty serviceAreas array when clinic has none", () => {
      const clinic = makeClinic({ serviceAreas: undefined });
      const { clinicConfig } = buildContextFromDb(makeLead(), clinic);
      expect(clinicConfig.serviceAreas).toEqual([]);
    });

    it("should pass through greetingTemplate and customInstructions", () => {
      const { clinicConfig } = buildContextFromDb(makeLead(), makeClinic());
      expect(clinicConfig.greetingTemplate).toBe("Hello {{firstName}}!");
      expect(clinicConfig.customInstructions).toBe(
        "Always mention free parking",
      );
    });

    it("should return undefined greetingTemplate when not configured", () => {
      const clinic = makeClinic({
        aiConfig: {
          tone: "friendly",
          greetingTemplate: "",
          customInstructions: "",
        },
      });
      const { clinicConfig } = buildContextFromDb(makeLead(), clinic);
      expect(clinicConfig.greetingTemplate).toBeUndefined();
    });

    it("should return undefined customInstructions when not configured", () => {
      const clinic = makeClinic({
        aiConfig: {
          tone: "friendly",
          greetingTemplate: "",
          customInstructions: "",
        },
      });
      const { clinicConfig } = buildContextFromDb(makeLead(), clinic);
      expect(clinicConfig.customInstructions).toBeUndefined();
    });
  });

  // Tone must map correctly — only 'professional' maps to 'Professional', everything else is 'Friendly'
  describe("tone mapping", () => {
    it('should map "professional" tone to "Professional"', () => {
      const clinic = makeClinic({ aiConfig: { tone: "professional" } });
      const { clinicConfig } = buildContextFromDb(makeLead(), clinic);
      expect(clinicConfig.tone).toBe("Professional");
    });

    it('should map "friendly" tone to "Friendly"', () => {
      const clinic = makeClinic({ aiConfig: { tone: "friendly" } });
      const { clinicConfig } = buildContextFromDb(makeLead(), clinic);
      expect(clinicConfig.tone).toBe("Friendly");
    });

    it('should default to "Friendly" when aiConfig is missing', () => {
      const clinic = makeClinic({ aiConfig: undefined });
      const { clinicConfig } = buildContextFromDb(makeLead(), clinic);
      expect(clinicConfig.tone).toBe("Friendly");
    });
  });
});
