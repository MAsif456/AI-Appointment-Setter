import { validate } from "class-validator";
import { IsUkPostcode } from "./is-uk-postcode.validator";

class PostcodeHolder {
  @IsUkPostcode()
  postcode!: unknown;
}

/** Builds a transient holder with the supplied value for validation. */
function build(value: unknown): PostcodeHolder {
  const h = new PostcodeHolder();
  h.postcode = value;
  return h;
}

describe("@IsUkPostcode", () => {
  it.each([
    "CF10 1AA",
    "cf10 1aa",
    "CF101AA", // optional space
    "W1A 1AA",
    "M1 1AA",
    "SW1A 1AA",
  ])("accepts a valid UK postcode: %s", async (value) => {
    const errors = await validate(build(value));
    expect(errors).toHaveLength(0);
  });

  it.each([
    "",
    "INVALID",
    "12345",
    "CF10",
    "CF10 1AAA", // inward too long
    "My postcode is CF10 1AA", // contains a postcode but not equal — must be rejected
  ])("rejects invalid input: %s", async (value) => {
    const errors = await validate(build(value));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isUkPostcode).toMatch(/UK postcode/);
  });

  it.each([null, undefined, 12345, { $regex: ".*" }])(
    "rejects non-string types: %p",
    async (value) => {
      const errors = await validate(build(value));
      expect(errors).toHaveLength(1);
    },
  );
});
