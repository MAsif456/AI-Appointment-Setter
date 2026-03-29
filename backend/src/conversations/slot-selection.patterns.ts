/**
 * Regex pattern constants used by the slot-selection resolver.
 * Kept in a separate file so the resolver stays under the 200-line limit.
 */

/** Week-range patterns that trigger the DAY_OVERVIEW flow. */
export const WEEK_PATTERNS = [
  /\bthis\s+week\b/, /\bnext\s+week\b/, /\bduring\s+(?:the\s+)?week\b/,
  /\bwithin\s+(?:the\s+)?week\b/, /\bover\s+(?:the\s+)?(?:next\s+)?week\b/,
  /\bin\s+(?:the\s+)?(?:next\s+)?week\b/, /\bany\s+day\s+(?:this|next)\s+week\b/,
  /\bsometime\s+(?:this|next)\s+week\b/, /\blater\s+(?:this|in\s+the)\s+week\b/,
  /\bearlier\s+(?:this|in\s+the)\s+week\b/, /\b(?:the\s+)?coming\s+week\b/,
  /\bweekday\b/, /\bin\s+(?:two|2|three|3)\s+weeks?\b/,
];

/** Time-of-day preference patterns in specificity order (most specific first). */
export const TIME_PREF_PATTERNS: { pattern: RegExp; pref: string }[] = [
  { pattern: /\b(?:anything|something|any\s*(?:thing|time)?s?)\s+(?:in\s+the\s+)?morning\b/i, pref: 'morning' },
  { pattern: /\b(?:before|around|from)\s+12\s*(?:pm|noon)?\b/i, pref: 'morning' },
  { pattern: /\b(?:before|around)\s+\d{1,2}\s*am\b/i, pref: 'morning' },
  { pattern: /\b(?:before|around)\s+(?:noon|midday|lunch)\b/i, pref: 'morning' },
  { pattern: /\bearly\s+(?:in\s+the\s+)?(?:day|morning)\b/i, pref: 'morning' },
  { pattern: /\bfirst\s+thing\b/i, pref: 'morning' },
  { pattern: /\bmorning\b/i, pref: 'morning' },
  { pattern: /\b(?:anything|something|any\s*(?:thing|time)?s?)\s+(?:in\s+the\s+)?afternoon\b/i, pref: 'afternoon' },
  { pattern: /\b(?:after|around|past|from)\s+12\s*(?:pm|noon)?\b/i, pref: 'afternoon' },
  { pattern: /\b(?:after|around|past|from)\s+\d{1,2}\s*(?:pm)?\b/i, pref: 'afternoon' },
  { pattern: /\b(?:after|past|from)\s+(?:noon|midday|lunch)\b/i, pref: 'afternoon' },
  { pattern: /\blater\s+(?:in\s+the\s+)?(?:day|afternoon)\b/i, pref: 'afternoon' },
  { pattern: /\bpm\s+(?:slots?|times?|appointments?)\b/i, pref: 'afternoon' },
  { pattern: /\bafternoon\b/i, pref: 'afternoon' },
  { pattern: /\bmidday\b/i, pref: 'afternoon' },
  { pattern: /\b(?:anything|something|any\s*(?:thing|time)?s?)\s+(?:in\s+the\s+)?evening\b/i, pref: 'evening' },
  { pattern: /\b(?:after|around|past|from)\s+(?:5|6|7)\s*(?:pm)?\b/i, pref: 'evening' },
  { pattern: /\blate\s+(?:in\s+the\s+)?(?:day|afternoon|evening)\b/i, pref: 'evening' },
  { pattern: /\bevening\b/i, pref: 'evening' },
  { pattern: /\bend\s+of\s+(?:the\s+)?day\b/i, pref: 'evening' },
];

/** Phrases that signal a request for the furthest available date. */
export const FURTHER_PHRASES = [
  'furthest date', 'furthest available', 'furthest availability',
  'latest date', 'latest available', 'latest availability',
  'further date', 'further dates', 'furthest', 'latest',
];
