import { Injectable } from "@nestjs/common";

// Context-aware HTML sanitisation for SMS/WhatsApp text messages.
// Strips dangerous HTML while preserving legitimate medical text like "pain <2 weeks".
//
// Design choice: lightweight regex
// Our messages are plain text, not HTML documents.
// DOMPurify would parse "pain <2 weeks" as a broken tag and mangle it.
// Ref: https://github.com/cure53/DOMPurify

// Tags that are always dangerous regardless of context
const DANGEROUS_TAGS = /(<script\b[^>]*>[\s\S]*?<\/script\s*>)/gi;
const STYLE_TAGS = /(<style\b[^>]*>[\s\S]*?<\/style\s*>)/gi;

// Known dangerous HTML elements — these are stripped even as self-closing
const DANGEROUS_ELEMENTS =
  /<\/?(script|iframe|object|embed|form|input|textarea|select|button|link|meta|base|applet)\b[^>]*>/gi;

// Event handler attributes (onclick, onerror, onload, etc.)
const EVENT_HANDLERS = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// HTML tags with attributes (e.g., <img src="x" onerror="alert(1)">)
// Only matches sequences that look like real HTML: <tagname followed by space+attributes or >
const TAGS_WITH_ATTRS = /<[a-z][a-z0-9]*\s+[^>]*>/gi;

// Closing tags (</div>, </p>, etc.)
const CLOSING_TAGS = /<\/[a-z][a-z0-9]*\s*>/gi;

// Null bytes and zero-width characters used in obfuscation
// Ref: attackers insert these to break regex patterns while keeping visual text intact
const INVISIBLE_CHARS = /[\x00\u200B\u200C\u200D\uFEFF\u00AD]/g;

@Injectable()
export class ContentSanitiserService {
  /**
   * Sanitises input text by removing dangerous HTML tags and attributes.
   * Preserves legitimate medical text like "pain <2 weeks>".
   * Strips invisible/null characters, script/style tags, dangerous elements,
   * event handler attributes, HTML tags with attributes, and closing tags.
   * Normalises whitespace left by stripping tags.
   * @param message The text to be sanitised
   * @return The sanitised text
   */
  sanitise(message: string): string {
    let result = message;

    // Step 1: Remove invisible/null characters first (deobfuscation)
    result = result.replace(INVISIBLE_CHARS, "");

    // Step 2: Remove <script>...</script> blocks entirely (content included)
    result = result.replace(DANGEROUS_TAGS, "");

    // Step 3: Remove <style>...</style> blocks entirely
    result = result.replace(STYLE_TAGS, "");

    // Step 4: Remove remaining dangerous elements (even without content)
    result = result.replace(DANGEROUS_ELEMENTS, "");

    // Step 5: Remove event handler attributes from any remaining tags
    result = result.replace(EVENT_HANDLERS, "");

    // Step 6: Remove HTML tags with attributes (e.g., <div class="x">)
    // This catches <img src="x">, <a href="...">, etc.
    result = result.replace(TAGS_WITH_ATTRS, "");

    // Step 7: Remove closing tags
    result = result.replace(CLOSING_TAGS, "");

    // Step 8: Normalise whitespace left by stripped tags
    result = result.replace(/\s{2,}/g, " ").trim();

    return result;
  }

  // "pain <2 weeks" is preserved because:
  // - DANGEROUS_TAGS: <2 doesn't match <script>...</script>
  // - DANGEROUS_ELEMENTS: <2 doesn't match </(script|iframe|...)>
  // - TAGS_WITH_ATTRS: <2 doesn't match <tagname space+attrs> (digit after <)
  // - CLOSING_TAGS: <2 doesn't match </tagname>
  // The angle bracket survives all steps because it's followed by a digit, not a letter.
}
