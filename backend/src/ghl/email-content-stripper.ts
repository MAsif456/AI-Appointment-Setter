// Ref: node-email-reply-parser — port of GitHub's email_reply_parser to Node.js.
//   https://github.com/nickstenning/email-reply-parser
// Handles quoted reply chains, signatures, and common email client patterns.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const parseEmail = require('node-email-reply-parser');

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&#39;': "'",
  '&quot;': '"',
  '&#x27;': "'",
  '&#x2F;': '/',
};

const ENTITY_PATTERN = new RegExp(
  Object.keys(HTML_ENTITY_MAP).join('|'),
  'gi',
);

/**
 * Sanitises an email message by removing invisible blocks, block-level elements,
 * tags, and quoted replies/signatures. Preserves legitimate medical text like
 * "pain <2 weeks>". Strips whitespace left by stripping tags.
 * @param rawHtml The raw HTML content of the email message
 * @return The sanitised text
 */
export function stripEmailContent(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) return '';

  let text = rawHtml;

  // 1. Remove invisible blocks
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');

  // 2. Block-level elements → newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n');

  // 3. Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // 4. Decode HTML entities
  text = text.replace(ENTITY_PATTERN, (match) => HTML_ENTITY_MAP[match.toLowerCase()] ?? match);

  // 5. Strip quoted replies and signatures
  // parseEmail(text, true) returns only the visible (non-quoted) text
  text = parseEmail(text, true) ?? text;

  // 6. Normalise whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export function isEmptyAfterStrip(content: string): boolean {
  return !content || !content.trim();
}
