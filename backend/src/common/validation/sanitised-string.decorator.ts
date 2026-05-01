import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * Pattern matching null bytes and zero-width / invisible Unicode characters
 * commonly used to obfuscate malicious payloads or smuggle data past
 * length checks. Mirrors the set used in ContentSanitiserService so the
 * trimming behaviour is consistent across the codebase.
 *
 * Coverage: NUL (0x00), zero-width space (200B), zero-width non-joiner
 * (200C), zero-width joiner (200D), zero-width no-break space / BOM
 * (FEFF) and soft hyphen (00AD). Built from explicit codepoints so the
 * source file stays readable in any editor that hides invisible glyphs.
 */
const INVISIBLE_CHARS = new RegExp(
  "[" +
    "\\u0000" +
    "\\u200B" +
    "\\u200C" +
    "\\u200D" +
    "\\uFEFF" +
    "\\u00AD" +
    "]",
  "g",
);

export interface SanitisedStringOptions {
  /** Maximum length allowed AFTER trimming/sanitisation. Required. */
  max: number;
  /** Minimum length allowed AFTER trimming/sanitisation. Defaults to 1. */
  min?: number;
}

/**
 * Cleans a single value at the parse boundary:
 *   1. Leaves non-strings untouched so @IsString rejects them with a
 *      clean "must be a string" message instead of a coerced result.
 *   2. Strips null bytes and invisible/zero-width characters.
 *   3. NFC-normalises Unicode so visually identical strings compare
 *      equally and homoglyph attacks (e.g. Cyrillic 'а' vs Latin 'a')
 *      cannot bypass downstream equality checks.
 *   4. Trims leading/trailing whitespace.
 *
 * @param value - The raw incoming value from the parsed JSON payload.
 * @returns The sanitised string, or the original value when it was not a string.
 */
function sanitiseValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const stripped = value.replace(INVISIBLE_CHARS, "");
  const normalised = stripped.normalize("NFC");
  return normalised.trim();
}

/**
 * Composite decorator combining the four checks every text DTO field
 * needs by default: type-check, length bounds, sanitising transform.
 *
 * Usage:
 *   `@SanitisedString({ max: 200 }) name: string;`
 *
 * Replaces the common `@IsString()` + `@MinLength(1)` + `@MaxLength(N)`
 * + ad-hoc trimming pattern with a single decorator. Use bare
 * `@IsString()` only when you genuinely need the raw, untrimmed value.
 *
 * @param options - Length bounds; min defaults to 1.
 */
export function SanitisedString(
  options: SanitisedStringOptions,
): PropertyDecorator {
  const min = options.min ?? 1;
  return applyDecorators(
    Transform(({ value }) => sanitiseValue(value)),
    IsString(),
    MinLength(min),
    MaxLength(options.max),
  );
}

/** Exported for unit-testing the transform in isolation. */
export const __testables = { sanitiseValue };
