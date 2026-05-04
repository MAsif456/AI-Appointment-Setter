import { validate } from "class-validator";
import { IsUkPhone } from "./is-uk-phone.validator";

class PhoneHolder {
  @IsUkPhone()
  phone!: unknown;
}

/** Builds a transient holder with the supplied value for validation. */
function build(value: unknown): PhoneHolder {
  const h = new PhoneHolder();
  h.phone = value;
  return h;
}

describe("@IsUkPhone", () => {
  it.each([
    "+44 29 2034 5678",
    "+4429 2034 5678",
    "029 2034 5678",
    "07700 900900",
    "07700900900",
  ])("accepts a valid UK number: %s", async (value) => {
    const errors = await validate(build(value));
    expect(errors).toHaveLength(0);
  });

  it.each([
    "",
    "29 2034 5678", // no prefix
    "0123", // too short
    "+1 555 123 4567", // wrong country code
    "abc def ghi",
    "0!!!!!!!!!",
  ])("rejects invalid input: %s", async (value) => {
    const errors = await validate(build(value));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isUkPhone).toMatch(/UK phone number/);
  });

  it.each([null, undefined, 12345, {}, [], { $gt: "" }])(
    "rejects non-string types: %p",
    async (value) => {
      const errors = await validate(build(value));
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isUkPhone).toMatch(/UK phone number/);
    },
  );
});
