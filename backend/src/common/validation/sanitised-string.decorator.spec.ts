import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  SanitisedString,
  __testables,
} from "./sanitised-string.decorator";

class NameDto {
  @SanitisedString({ max: 200 })
  name!: string;
}

class MessageDto {
  @SanitisedString({ max: 5000, min: 1 })
  message!: string;
}

/** Pipes a raw payload through class-transformer + class-validator. */
async function check<T extends object>(
  cls: new () => T,
  payload: unknown,
): Promise<{ instance: T; errors: Awaited<ReturnType<typeof validate>> }> {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance as object);
  return { instance, errors };
}

describe("@SanitisedString", () => {
  describe("trimming and sanitising transform", () => {
    it("trims surrounding whitespace", async () => {
      const { instance, errors } = await check(NameDto, {
        name: "  Cardiff Clinic  ",
      });
      expect(errors).toHaveLength(0);
      expect(instance.name).toBe("Cardiff Clinic");
    });

    it("strips null bytes", async () => {
      const { instance, errors } = await check(NameDto, {
        name: "Card\x00iff",
      });
      expect(errors).toHaveLength(0);
      expect(instance.name).toBe("Cardiff");
    });

    it("strips zero-width / invisible Unicode characters", async () => {
      // Zero-width space (200B) hidden between letters
      const sneaky = "Card​iff";
      const { instance } = await check(NameDto, { name: sneaky });
      expect(instance.name).toBe("Cardiff");
    });

    it("NFC-normalises Unicode so visually identical strings compare equally", () => {
      // NFD form: "é" expressed as e + combining acute accent.
      const decomposed = "é";
      const composed = "é";
      expect(__testables.sanitiseValue(decomposed)).toBe(composed);
    });
  });

  describe("validation", () => {
    it("accepts a typical valid string within bounds", async () => {
      const { errors } = await check(NameDto, { name: "Cardiff Clinic" });
      expect(errors).toHaveLength(0);
    });

    it("rejects strings longer than max", async () => {
      const { errors } = await check(NameDto, { name: "x".repeat(201) });
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty("maxLength");
    });

    it("rejects strings shorter than min (default 1)", async () => {
      const { errors } = await check(NameDto, { name: "" });
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty("minLength");
    });

    it("rejects empty-after-trim strings", async () => {
      const { errors } = await check(NameDto, { name: "    " });
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty("minLength");
    });

    it("rejects non-string values like NoSQL operator objects", async () => {
      const { errors } = await check(NameDto, { name: { $gt: "" } });
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty("isString");
    });

    it("rejects messages longer than the configured 5000 cap", async () => {
      const { errors } = await check(MessageDto, {
        message: "a".repeat(5001),
      });
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty("maxLength");
    });
  });
});
