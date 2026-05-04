/**
 * Set of regex meta-characters that, if left unescaped, allow an attacker
 * to mount a NoSQL injection or ReDoS attack via a `$regex`-shaped query.
 * Mirrors the recommendation in the OWASP NoSQL injection cheat sheet.
 */
const REGEX_META = /[.*+?^${}()|[\]\\]/g;

/**
 * Escapes every regex metacharacter in `input` so the resulting string
 * matches itself literally when interpolated into a Mongo `$regex`
 * operator (or a JavaScript RegExp constructor).
 *
 * Designed to be the single source of truth for "make this user string
 * safe to put inside a Mongo regex" — call it at the boundary; never
 * pass raw user input to `$regex`.
 *
 * @param input - The untrusted string to escape.
 * @returns A version of `input` with every regex meta-character preceded
 *          by a backslash; non-string input is coerced to an empty string.
 */
export function escapeRegex(input: string): string {
  if (typeof input !== "string") return "";
  return input.replace(REGEX_META, "\\$&");
}
