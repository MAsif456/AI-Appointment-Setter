/**
 * Service for validating and extracting UK postcodes from free-text messages,
 * and checking whether an extracted postcode falls within a clinic's service area.
 *
 * Public API:
 *   validate(message, serviceAreas)   — full pipeline: extract → normalise → area check
 *   extractFromMessage(message)       — find the first valid UK postcode in any string
 *   normalise(raw)                    — uppercase + correct spacing (CF101AA → CF10 1AA)
 *   extractPrefix(postcodeOrOutward)  — leading letters only (CF10 1AA → "CF")
 *   isInServiceArea(postcode, areas)  — kept for backward compatibility
 */
import { Injectable } from "@nestjs/common";
import { UK_POSTCODE_EXTRACT_REGEX } from "../common/validation/uk-formats";

/** Possible outcomes from validate(). */
export type PostcodeValidationStatus =
  | "valid"
  | "invalid_area"
  | "invalid_format";

export interface PostcodeValidationResult {
  status: PostcodeValidationStatus;
  /** Normalised postcode, e.g. "CF10 1AA". Present when a valid postcode was found. */
  postcode?: string;
  /** Outward-code prefix (letters only), e.g. "CF". Present when a valid postcode was found. */
  prefix?: string;
}

/**
 * Word-bounded extraction regex sourced from the central uk-formats module
 * so the extraction rule cannot drift from the strict DTO validator.
 */
const EXTRACT_REGEX = UK_POSTCODE_EXTRACT_REGEX;

@Injectable()
export class PostcodeValidationService {
  /**
   * Full validation pipeline.
   *
   * 1. Extract the first valid UK postcode from the message.
   * 2. Normalise it to "CF10 1AA" form.
   * 3. Check against the clinic's service areas.
   *
   * Returns `invalid_format` when no valid postcode is found.
   */
  validate(message: string, serviceAreas: string[]): PostcodeValidationResult {
    const raw = this.extractFromMessage(message);
    if (!raw) {
      return { status: "invalid_format" };
    }

    const postcode = this.normalise(raw);
    const prefix = this.extractPrefix(postcode);

    if (!serviceAreas || serviceAreas.length === 0) {
      return { status: "valid", postcode, prefix };
    }

    const outward = postcode.split(" ")[0];
    const inArea = serviceAreas.some((area) =>
      outward.toUpperCase().startsWith(area.toUpperCase()),
    );

    return inArea
      ? { status: "valid", postcode, prefix }
      : { status: "invalid_area", postcode, prefix };
  }

  /**
   * Extracts the first valid UK postcode from a free-text message.
   * Returns null when no valid postcode is found.
   *
   * Examples:
   *   "My postcode is CF10 1AA by the way" → "CF10 1AA"
   *   "cf101aa"                            → "cf101aa"
   *   "CF10 1AAA"                          → null  (word boundary blocks partial match)
   */
  extractFromMessage(message: string): string | null {
    if (!message) return null;
    const match = message.match(EXTRACT_REGEX);
    return match ? match[0] : null;
  }

  /**
   * Normalises a raw postcode to uppercase with correct spacing.
   * The UK inward code is always exactly 3 characters (1 digit + 2 letters).
   *
   * Examples: "cf101aa" → "CF10 1AA", "W1A1AA" → "W1A 1AA"
   */
  normalise(raw: string): string {
    const upper = raw.toUpperCase().replace(/\s+/g, "");
    return `${upper.slice(0, -3)} ${upper.slice(-3)}`;
  }

  /**
   * Extracts the alphabetic prefix (area code) from a postcode or outward code.
   * Accepts either a full normalised postcode ("CF10 1AA") or just the outward code ("CF10").
   *
   * Examples: "CF10 1AA" → "CF", "W1A 1AA" → "W", "SW1A" → "SW"
   */
  extractPrefix(postcodeOrOutward: string): string {
    const outward = postcodeOrOutward.split(" ")[0];
    const match = outward.match(/^[A-Z]+/i);
    return match ? match[0].toUpperCase() : "";
  }

  /**
   * Returns true when the normalised postcode falls within at least one of the
   * configured service areas, or when no service areas are configured.
   * Kept for backward compatibility with the inbound-message flow.
   *
   * @param postcode    A normalised postcode, e.g. "CF10 1AA".
   * @param serviceAreas Outward-code prefixes the clinic serves, e.g. ["CF", "NP"].
   */
  isInServiceArea(postcode: string, serviceAreas: string[]): boolean {
    if (!serviceAreas || serviceAreas.length === 0) {
      return true;
    }
    const outwardCode = postcode.split(" ")[0].toUpperCase();
    return serviceAreas.some((area) =>
      outwardCode.startsWith(area.toUpperCase()),
    );
  }
}
