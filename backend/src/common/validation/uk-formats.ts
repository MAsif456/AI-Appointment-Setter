/**
 * Single source of truth for UK-specific regex patterns used in input
 * validation. Kept in one file so the rules cannot drift between, for
 * example, the form-level validator and the message-extraction service.
 *
 * Each regex is exposed as a constant so the file can be unit-tested in
 * isolation without instantiating any Nest providers.
 */

/**
 * Strict full-match UK phone number — anchored with ^/$ so the whole
 * input must be the phone number. Accepts either +44 or 0 prefix and
 * 8–12 trailing digits with optional whitespace separators.
 *
 * Examples accepted:  "+44 29 2034 5678", "029 2034 5678", "07700900900"
 * Examples rejected:  "29 2034 5678" (no prefix), "0123" (too short)
 */
export const UK_PHONE_REGEX = /^(\+44\s?|0)\d[\d\s]{8,12}$/;

/**
 * Strict full-match UK postcode — anchored, requires the standard
 * outward + inward structure with exactly one optional space between them.
 * Use this for DTO field validation where the entire string MUST be a
 * postcode.
 *
 * Outward: 1–2 letters + 1 digit + optional digit-or-letter (CF10, W1A)
 * Inward:  1 digit + 2 letters                              (1AA)
 */
export const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

/**
 * Extraction regex — finds the first UK postcode embedded in any string.
 * Word-bounded (\b) rather than anchored, so it can pull a postcode out
 * of a free-text message like "My postcode is CF10 1AA by the way".
 *
 * Used by PostcodeValidationService.extractFromMessage. Do NOT use this
 * for DTO validation — it would accept any string that *contains* a
 * postcode, including malicious wrappers.
 */
export const UK_POSTCODE_EXTRACT_REGEX =
  /\b[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}\b/i;
