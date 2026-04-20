import "reflect-metadata";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import {
  UpdateClinicSettingsDto,
  UpdateBusinessHoursDto,
  UpdateServiceAreaDto,
} from "./update-clinic-settings.dto";

/**
 * Validation tests for UpdateClinicSettingsDto and its nested DTOs.
 *
 * All fields are optional (partial update), but validated when present.
 */
describe("UpdateClinicSettingsDto validation", () => {
  async function validateDto(data: Record<string, unknown>) {
    return validate(plainToInstance(UpdateClinicSettingsDto, data));
  }

  it("should pass with an empty body (no updates)", async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it("should pass with a valid name", async () => {
    const errors = await validateDto({ name: "Cardiff Physio" });
    expect(errors).toHaveLength(0);
  });

  it("should reject empty name when provided", async () => {
    const errors = await validateDto({ name: "" });
    expect(
      errors.find((e) => e.property === "name")?.constraints,
    ).toHaveProperty("isNotEmpty");
  });

  it("should pass with a valid address", async () => {
    const errors = await validateDto({ address: "123 Queen Street" });
    expect(errors).toHaveLength(0);
  });

  it("should reject empty address when provided", async () => {
    const errors = await validateDto({ address: "" });
    expect(
      errors.find((e) => e.property === "address")?.constraints,
    ).toHaveProperty("isNotEmpty");
  });

  it("should pass with a valid UK phone number", async () => {
    const errors = await validateDto({ phone: "029 2034 5678" });
    expect(errors).toHaveLength(0);
  });

  it("should pass with a +44 phone number", async () => {
    const errors = await validateDto({ phone: "+44 29 2034 5678" });
    expect(errors).toHaveLength(0);
  });

  it("should reject empty phone when provided", async () => {
    const errors = await validateDto({ phone: "" });
    expect(errors.find((e) => e.property === "phone")).toBeDefined();
  });

  it("should reject invalid phone format", async () => {
    const errors = await validateDto({ phone: "not a phone" });
    expect(
      errors.find((e) => e.property === "phone")?.constraints,
    ).toHaveProperty("matches");
  });

  it("should pass with valid service areas", async () => {
    const errors = await validateDto({
      serviceAreas: [{ postcodePrefix: "CF" }, { postcodePrefix: "NP" }],
    });
    expect(errors).toHaveLength(0);
  });

  it("should pass with valid business hours", async () => {
    const errors = await validateDto({
      businessHours: [
        { day: "monday", isOpen: true, openTime: "09:00", closeTime: "17:00" },
        { day: "sunday", isOpen: false },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it("should pass with all fields provided", async () => {
    const errors = await validateDto({
      name: "Updated Clinic",
      address: "456 New Street",
      phone: "029 2099 1234",
      ghlLocationId: "loc_new_001",
      serviceAreas: [{ postcodePrefix: "CF" }],
      businessHours: [{ day: "monday", isOpen: true, openTime: "08:00", closeTime: "18:00" }],
    });
    expect(errors).toHaveLength(0);
  });
});

describe("UpdateServiceAreaDto validation", () => {
  it("should reject lowercase postcode prefix", async () => {
    const dto = plainToInstance(UpdateServiceAreaDto, { postcodePrefix: "cf" });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it("should reject prefix longer than 4 characters", async () => {
    const dto = plainToInstance(UpdateServiceAreaDto, { postcodePrefix: "ABCDE" });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it("should accept valid postcode prefixes", async () => {
    for (const prefix of ["CF", "NP", "B", "SA"]) {
      const dto = plainToInstance(UpdateServiceAreaDto, { postcodePrefix: prefix });
      expect(await validate(dto)).toHaveLength(0);
    }
  });
});

describe("UpdateBusinessHoursDto validation", () => {
  it("should pass with a valid open day", async () => {
    const dto = plainToInstance(UpdateBusinessHoursDto, {
      day: "monday",
      isOpen: true,
      openTime: "09:00",
      closeTime: "17:00",
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("should pass with a closed day without times", async () => {
    const dto = plainToInstance(UpdateBusinessHoursDto, {
      day: "sunday",
      isOpen: false,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
