/**
 * Slot Selection Detector — analyses a lead's free-text reply and determines
 * which (if any) previously offered slot they have selected.
 * Uses keyword/pattern matching only, so results are deterministic and testable.
 */
import { SlotSelectionResult, SlotSelectionIntent, OfferedSlotRef } from './slot-selector.types';

export type { SlotSelectionResult, SlotSelectionIntent, OfferedSlotRef };

/** Result of detecting a date-range preference from a raw message */
export interface DateRangePreference {
  startDate: Date;
  endDate: Date;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const NONE_SUITABLE_PHRASES = [
  'none of those', 'none of them', "don't work", 'dont work', 'dosent work', 'doesnt work',
  "doesn't work", 'nothing works', 'not available', 'none work', "can't make any",
  'cant make any', 'none of these', "won't work", 'wont work', 'none do',
  "don't suit", 'dont suit', "doesn't suit", 'doesnt suit',
];

const DIFFERENT_TIME_KEYWORDS: Record<string, string> = {
  'earlier in the morning': 'morning',
  'earlier in the day': 'earlier',
  'morning': 'morning',
  'afternoon': 'afternoon',
  'evening': 'evening',
  'earlier': 'earlier',
  'later': 'later',
};

const POSITIONAL_MAP: Record<string, number> = {
  first: 0, '1st': 0,
  second: 1, '2nd': 1,
  third: 2, '3rd': 2,
  last: -1, // resolved at runtime against total slot count
};

/** Extracts the day name from a displayText like "Thursday 17th March at 2pm" */
function extractDayFromDisplay(displayText: string): string | null {
  const lower = displayText.toLowerCase();
  return DAY_NAMES.find(d => lower.startsWith(d.toLowerCase())) ?? null;
}

/** Extracts the formatted time from a displayText like "Thursday 17th March at 2pm" */
function extractTimeFromDisplay(displayText: string): string | null {
  const match = displayText.match(/at\s+(\d{1,2}(?::\d{2})?(?:am|pm))/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Normalises a raw time string so it can be compared with display-text times.
 * Converts 24-hour strings (e.g. "14:00") to 12-hour format (e.g. "2pm").
 */
export function normaliseTime(raw: string): string {
  // Normalise dot separators to colons (e.g. "9.20" → "9:20")
  const lower = raw.toLowerCase().trim().replace('.', ':');
  if (/^\d{1,2}(?::\d{2})?(?:am|pm)$/.test(lower)) return lower.replace(/^0/, '');
  const match24 = lower.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    const period = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
  }
  // 3-4 digit time like "930" → "9:30", "1030" → "10:30" → normalise to 12-hour
  const multiDigit = lower.match(/^(\d{1,2})(\d{2})$/);
  if (multiDigit) {
    const h = parseInt(multiDigit[1], 10);
    const m = parseInt(multiDigit[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const period = h >= 12 ? 'pm' : 'am';
      const h12 = h % 12 || 12;
      return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
    }
  }
  // Bare number like "9" → try as hour (assume am for single digits ≤ 12)
  const bareHour = lower.match(/^(\d{1,2})$/);
  if (bareHour) {
    const h = parseInt(bareHour[1], 10);
    if (h >= 1 && h <= 12) return `${h}am`;
    if (h > 12 && h <= 23) {
      const h12 = h % 12 || 12;
      return `${h12}pm`;
    }
  }
  return lower;
}

/** Flips am↔pm suffix for ambiguous time matching */
function flipPeriod(time: string): string {
  if (time.endsWith('am')) return time.slice(0, -2) + 'pm';
  if (time.endsWith('pm')) return time.slice(0, -2) + 'am';
  return time;
}

/** Returns true if the message indicates none of the offered slots are suitable */
function detectNoneSuitable(message: string): boolean {
  const lower = message.toLowerCase();
  return NONE_SUITABLE_PHRASES.some(phrase => lower.includes(phrase));
}

/** Result of date detection — either a day name or a computed date range */
interface DateDetectionResult {
  /** Day name when the lead asks for a specific day (e.g. "Friday") */
  dayName?: string;
  /** Computed start date when the lead asks for a future range */
  startDate?: Date;
  /** Computed end date when the lead asks for a future range */
  endDate?: Date;
}

/** Word-to-number map for week/month offset parsing */
const WORD_TO_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
};

/** Month names for detecting "in April", "sometime in June" etc. */
const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Phrases that indicate a future date range, mapped to a resolver function */
const DATE_RANGE_PATTERNS: { pattern: RegExp; resolve: () => { start: Date; end: Date } }[] = [
  {
    pattern: /\b(?:same[\s-]?day|today|asap|as\s+soon\s+as\s+possible|right\s+away|urgent)\b/i,
    resolve: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setDate(today.getDate() + 1);
      return { start: today, end };
    },
  },
  {
    pattern: /\b(?:next\s+week|a\s+week\s+from\s+now|in\s+a\s+week)\b/i,
    resolve: () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      // Next Monday
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const start = new Date(today);
      start.setDate(today.getDate() + daysUntilMonday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end };
    },
  },
  {
    pattern: /\b(?:this\s+week)\b/i,
    resolve: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      // End of this week (Sunday)
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const end = new Date(today);
      end.setDate(today.getDate() + daysUntilSunday + 1);
      return { start: today, end };
    },
  },
  {
    pattern: /\b(?:in\s+two\s+weeks|in\s+2\s+weeks|two\s+weeks\s+from\s+now)\b/i,
    resolve: () => {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() + 14);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end };
    },
  },
  {
    pattern: /\b(?:tomorrow)\b/i,
    resolve: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const end = new Date(tomorrow);
      end.setDate(tomorrow.getDate() + 1);
      return { start: tomorrow, end };
    },
  },
  {
    pattern: /\b(?:next\s+month)\b/i,
    resolve: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 1);
      return { start, end };
    },
  },
  {
    pattern: /\b(?:this\s+month)\b/i,
    resolve: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start: today, end };
    },
  },
];

/**
 * Checks whether the message is asking for a completely different date.
 * Handles both specific day names (e.g. "Friday") and relative date
 * phrases (e.g. "next week", "tomorrow", "in two weeks").
 * @returns A DateDetectionResult with either a day name or a date range, or null
 */
/**
 * Date keywords to extract from garbled input, sorted longest-first
 * so multi-word phrases and longer words match before their substrings.
 */
const DATE_KEYWORDS = [
  'as soon as possible', 'two weeks from now',
  'in two weeks', 'in 2 weeks', 'right away',
  'this week', 'next week', 'next month', 'this month',
  'same-day', 'same day',
  'tomorrow', 'flexible', 'wednesday', 'thursday',
  'saturday', 'tuesday', 'friday', 'sunday', 'monday',
  'september', 'february', 'november', 'december', 'january',
  'october', 'august', 'march', 'april', 'june', 'july',
  'morning', 'afternoon', 'evening',
  'urgent', 'today', 'weeks', 'asap', 'week', 'month',
].sort((a, b) => b.length - a.length);

/** Returns true if the character is a letter */
function isLetter(ch: string | undefined): boolean {
  return !!ch && /[a-zA-Z]/.test(ch);
}

/**
 * Cleans a message by isolating known date keywords even when surrounded
 * by junk characters (e.g. "adfjweekfdas" → " week ", "AStodayXX" → " today ").
 * Only modifies words where the keyword is embedded in junk — properly
 * bounded words (e.g. "weeks" matching "week") are left untouched.
 */
function cleanDateMessage(message: string): string {
  let cleaned = message;

  for (const kw of DATE_KEYWORDS) {
    const lower = cleaned.toLowerCase();
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;

    const charBefore = idx > 0 ? cleaned[idx - 1] : undefined;
    const charAfter = idx + kw.length < cleaned.length ? cleaned[idx + kw.length] : undefined;
    const junkBefore = isLetter(charBefore);
    const junkAfter = isLetter(charAfter);

    // Only clean if there's genuine junk (3+ extra letters) around the keyword,
    // not just normal suffixes like "weeks" or "today's"
    const wordStart = junkBefore ? idx - 1 : idx;
    const wordEnd = junkAfter ? idx + kw.length + 1 : idx + kw.length;
    // Find the full "word" around this keyword
    let ws = idx;
    while (ws > 0 && isLetter(cleaned[ws - 1])) ws--;
    let we = idx + kw.length;
    while (we < cleaned.length && isLetter(cleaned[we])) we++;
    const fullWord = cleaned.slice(ws, we);
    const junkLen = fullWord.length - kw.length;

    // Only insert spaces if there's significant junk (more than 1 extra char)
    if (junkLen > 1) {
      const prefix = junkBefore ? ' ' : '';
      const suffix = junkAfter ? ' ' : '';
      cleaned = cleaned.slice(0, idx) + prefix + kw + suffix + cleaned.slice(idx + kw.length);
    }
  }
  return cleaned;
}

function detectDifferentDate(message: string): DateDetectionResult | null {
  // Clean the message to handle garbled input with date keywords buried inside
  const msg = cleanDateMessage(message);

  // "N week(s) from next week" — compound phrase, must be checked before simple patterns
  const weeksFromNextWeek = msg.match(
    /\b(\d+|one|two|three|four)\s+weeks?\s+(?:from|after|past|f+r+o+m+)\s+next\s+week\b/i,
  );
  if (weeksFromNextWeek) {
    const n = WORD_TO_NUM[weeksFromNextWeek[1].toLowerCase()] ?? parseInt(weeksFromNextWeek[1], 10);
    if (n > 0) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 0, 0, 0);
      const start = new Date(nextMonday);
      start.setDate(nextMonday.getDate() + n * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { startDate: start, endDate: end };
    }
  }

  // Check for date range phrases first (more specific)
  for (const { pattern, resolve } of DATE_RANGE_PATTERNS) {
    if (pattern.test(msg)) {
      const { start, end } = resolve();
      return { startDate: start, endDate: end };
    }
  }

  // Check for "the first/second/third/fourth/last week of [month]" phrases
  const weekOfMonthPattern = /\b(?:the\s+)?(first|second|third|fourth|last|1st|2nd|3rd|4th)\s+week\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
  const weekOfMonthMatch = msg.match(weekOfMonthPattern);
  if (weekOfMonthMatch) {
    const weekWord = weekOfMonthMatch[1].toLowerCase();
    const monthIdx = MONTH_NAMES[weekOfMonthMatch[2].toLowerCase()];
    if (monthIdx !== undefined) {
      const weekMap: Record<string, number> = {
        first: 0, '1st': 0, second: 1, '2nd': 1,
        third: 2, '3rd': 2, fourth: 3, '4th': 3, last: -1,
      };
      const weekNum = weekMap[weekWord];
      const today = new Date();
      let year = today.getFullYear();
      if (monthIdx < today.getMonth() || (monthIdx === today.getMonth() && today.getDate() > 28)) {
        year++;
      }
      let start: Date;
      if (weekNum === -1) {
        // Last week: go to the last day of the month and back up to the Monday
        const lastDay = new Date(year, monthIdx + 1, 0);
        const dayOfWeek = lastDay.getDay();
        const daysBackToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start = new Date(lastDay);
        start.setDate(lastDay.getDate() - daysBackToMonday);
      } else {
        // First day of month, find the first Monday, then offset by weekNum weeks
        const firstOfMonth = new Date(year, monthIdx, 1);
        const dayOfWeek = firstOfMonth.getDay();
        const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
        start = new Date(firstOfMonth);
        start.setDate(firstOfMonth.getDate() + daysToMonday + weekNum * 7);
        // For "first week", if Monday is after the 1st, include days from the 1st
        if (weekNum === 0 && daysToMonday > 0) {
          start = firstOfMonth;
        }
      }
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { startDate: start, endDate: end };
    }
  }

  // Check for "the first/second/third/fourth/last week" without a month name
  // Uses the most recently discussed month context (from previously offered slots)
  const weekOnlyPattern = /\b(?:the\s+)?(first|second|third|fourth|last|1st|2nd|3rd|4th)\s+week\b/i;
  const weekOnlyMatch = msg.match(weekOnlyPattern);
  // Only trigger if the message does NOT contain a month name (otherwise the pattern above handles it)
  if (weekOnlyMatch && !weekOfMonthMatch) {
    // Ignore if it looks like a relative phrase (e.g. "first week of next month")
    if (!/week\s+of\s+next/i.test(msg)) {
      const weekWord = weekOnlyMatch[1].toLowerCase();
      const weekMap: Record<string, number> = {
        first: 0, '1st': 0, second: 1, '2nd': 1,
        third: 2, '3rd': 2, fourth: 3, '4th': 3, last: -1,
      };
      const weekNum = weekMap[weekWord];
      // Default to next month if no context
      const today = new Date();
      const monthIdx = today.getMonth() + 1;
      const year = monthIdx > 11 ? today.getFullYear() + 1 : today.getFullYear();
      const actualMonth = monthIdx > 11 ? 0 : monthIdx;
      let start: Date;
      if (weekNum === -1) {
        const lastDay = new Date(year, actualMonth + 1, 0);
        const dayOfWeek = lastDay.getDay();
        const daysBackToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start = new Date(lastDay);
        start.setDate(lastDay.getDate() - daysBackToMonday);
      } else {
        const firstOfMonth = new Date(year, actualMonth, 1);
        const dayOfWeek = firstOfMonth.getDay();
        const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
        start = new Date(firstOfMonth);
        start.setDate(firstOfMonth.getDate() + daysToMonday + weekNum * 7);
        if (weekNum === 0 && daysToMonday > 0) {
          start = firstOfMonth;
        }
      }
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { startDate: start, endDate: end };
    }
  }

  // Check for "in N months" / "N months from now" / "N months later" / "N months away"
  const inMonthsMatch = msg.match(
    /\b(?:in\s+)?(\d+|one|two|three|four|five|six)\s+months?\s*(?:from\s+(?:now|today)|later|away|ahead|time)?\b/i,
  );
  // Only match if the phrase starts with "in" OR ends with a qualifier — avoid bare "2 months"
  // matching when actually part of "2 months from that date" (pronoun case handled elsewhere)
  if (inMonthsMatch && (/\bin\s+/i.test(msg) || /months?\s+(?:from\s+(?:now|today)|later|away|ahead|time)\b/i.test(msg))) {
    // Exclude "from that/the/this" — those need pronoun resolution from offered slots
    if (!/months?\s+from\s+(?:that|the|this)/i.test(msg)) {
      const n = WORD_TO_NUM[inMonthsMatch[1].toLowerCase()] ?? parseInt(inMonthsMatch[1], 10);
      if (n > 0 && n <= 4) {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth() + n, 1);
        const end = new Date(today.getFullYear(), today.getMonth() + n + 1, 1);
        return { startDate: start, endDate: end };
      }
    }
  }

  // Check for "in N weeks" / "N weeks from now" / "N weeks later"
  const inWeeksMatch = msg.match(
    /\b(?:in\s+)?(\d+|one|two|three|four|five|six)\s+weeks?\s*(?:from\s+(?:now|today)|later|away|ahead|time)?\b/i,
  );
  if (inWeeksMatch && (/\bin\s+\d/i.test(msg) || /weeks?\s+(?:from\s+(?:now|today)|later|away|ahead|time)\b/i.test(msg))) {
    if (!/weeks?\s+from\s+(?:that|the|this)/i.test(msg)) {
      const n = WORD_TO_NUM[inWeeksMatch[1].toLowerCase()] ?? parseInt(inWeeksMatch[1], 10);
      if (n > 0 && n <= 12) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setDate(today.getDate() + n * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return { startDate: start, endDate: end };
      }
    }
  }

  // Check for "Nth [of] Month" patterns (e.g. "1st April", "the 3rd of June", "Wednesday 1st April")
  // Must run before the generic month-name match so "1st April" returns a single-day range, not the whole month.
  const MONTH_NAMES_RE = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
  const ordinalMonthPattern = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_NAMES_RE})\\b`, 'i',
  );
  const ordinalMonthMatch = msg.match(ordinalMonthPattern);
  if (ordinalMonthMatch) {
    const dayNum = parseInt(ordinalMonthMatch[1], 10);
    const monthIdx = MONTH_NAMES[ordinalMonthMatch[2].toLowerCase()];
    if (dayNum >= 1 && dayNum <= 31 && monthIdx !== undefined) {
      const today = new Date();
      let year = today.getFullYear();
      if (monthIdx < today.getMonth() || (monthIdx === today.getMonth() && dayNum < today.getDate())) {
        year++;
      }
      const candidate = new Date(year, monthIdx, dayNum);
      if (candidate.getDate() === dayNum) {
        const end = new Date(candidate);
        end.setDate(candidate.getDate() + 1);
        return { startDate: candidate, endDate: end };
      }
    }
  }

  // Check for month name references (e.g. "in April", "sometime in June", "April")
  const monthNamePattern = /\b(?:in\s+|sometime\s+in\s+|during\s+)?(?:the\s+month\s+of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
  const monthNameMatch = msg.match(monthNamePattern);
  if (monthNameMatch) {
    const monthIdx = MONTH_NAMES[monthNameMatch[1].toLowerCase()];
    if (monthIdx !== undefined) {
      const today = new Date();
      let year = today.getFullYear();
      // If the month has passed this year, use next year
      if (monthIdx < today.getMonth() || (monthIdx === today.getMonth() && today.getDate() > 28)) {
        year++;
      }
      const start = new Date(year, monthIdx, 1);
      const end = new Date(year, monthIdx + 1, 1);
      return { startDate: start, endDate: end };
    }
  }

  // Check for specific date-of-month references (e.g. "on the 30th", "the 15th", "on 3rd", "on the 30")
  // Two patterns: with ordinal suffix (any context), or bare number only after "on"/"on the"
  // Excludes positional phrases like "the 1st one" or "the 2nd" when ≤ 3 (handled by slot selection)
  // UNLESS preceded by a day name (e.g. "Friday 3rd" is clearly a date, not a position).
  const dateOfMonthMatch =
    msg.match(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\s+one)/i) ||
    msg.match(/\bon\s+(?:the\s+)?(\d{1,2})\b/i);
  if (dateOfMonthMatch) {
    const day = parseInt(dateOfMonthMatch[1], 10);
    // Allow 1-3 if preceded by a day name (e.g. "Friday 3rd"), otherwise require >= 4
    const DAY_NAMES_RE = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
    const hasDayNamePrefix = DAY_NAMES_RE.test(msg.substring(0, dateOfMonthMatch.index));
    const minDay = hasDayNamePrefix ? 1 : 4;
    if (day >= minDay && day <= 31) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Try this month first, then next month
      let candidate = new Date(today.getFullYear(), today.getMonth(), day);
      // If the day doesn't exist in this month (e.g. 31st in a 30-day month),
      // JavaScript rolls over to the next month — detect and skip to a valid month
      if (candidate.getDate() !== day) {
        candidate = new Date(today.getFullYear(), today.getMonth() + 1, day);
      }
      if (candidate < today) {
        candidate.setMonth(candidate.getMonth() + 1);
      }
      // Final validity check — if the day still doesn't exist (e.g. 31st Feb → 3rd Mar)
      if (candidate.getDate() !== day) {
        // Skip to the next month where this day exists (within 4 months — GHL limit)
        for (let i = 0; i < 4; i++) {
          candidate.setMonth(candidate.getMonth() + 1);
          candidate.setDate(day);
          if (candidate.getDate() === day) break;
          // Reset to 1st before trying next month to avoid cascading overflow
          candidate.setDate(1);
        }
      }
      if (candidate.getDate() === day) {
        const end = new Date(candidate);
        end.setDate(candidate.getDate() + 1);
        return { startDate: candidate, endDate: end };
      }
    }
  }

  // Fall back to specific day name detection
  const patterns = [
    /(?:anything|available|availability|slots?)\s+on\s+(\w+)/i,
    /(?:what about|how about)\s+(\w+)/i,
    /(?:on|for)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  ];
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      const day = DAY_NAMES.find(d => d.toLowerCase() === match[1].toLowerCase());
      if (day) return { dayName: day };
    }
  }
  // Day mentioned in a question without a more specific pattern
  if (msg.includes('?')) {
    for (const day of DAY_NAMES) {
      if (msg.toLowerCase().includes(day.toLowerCase())) return { dayName: day };
    }
  }
  return null;
}

/**
 * Detects date-range preferences from any message, even when no slots
 * have been offered yet.  Used by the conversation service to filter
 * the initial slot fetch when the lead mentions a timing preference
 * (e.g. "this week", "next week") before slots are presented.
 *
 * @returns A DateRangePreference with start/end dates, or null
 */
export function detectDateRangePreference(message: string): DateRangePreference | null {
  const result = detectDifferentDate(message);
  if (result?.startDate && result?.endDate) {
    return { startDate: result.startDate, endDate: result.endDate };
  }
  return null;
}

/**
 * Checks whether the message expresses a time-of-day preference.
 * Longer phrases checked first to avoid partial matches.
 * @returns Preference string (e.g. "morning") if detected, otherwise null
 */
function detectDifferentTime(message: string): string | null {
  const lower = message.toLowerCase();
  const phrases = Object.keys(DIFFERENT_TIME_KEYWORDS).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    if (lower.includes(phrase)) return DIFFERENT_TIME_KEYWORDS[phrase];
  }
  return null;
}

/**
 * Phrases indicating the lead is asking for alternative/other options
 * (e.g. "what other times", "any other availability", "other options").
 * When combined with a day name, this means "other times on that day",
 * not "I want to book that day".
 */
const OTHER_OPTIONS_PHRASES = [
  // "other / more / different / alternative" variants
  'what other', 'any other', 'other times', 'other time',
  'other options', 'other availability', 'other slots',
  'what else', 'anything else available',
  'more options', 'more times', 'more availability',
  'different times', 'different time', 'different options',
  'alternative times', 'alternative time', 'alternatives',
  // "all / every / full list" variants — user wants to see everything, not confirm
  'all the times', 'all the available times', 'all available times',
  'all times available', 'all the slots', 'all available slots',
  'all the options', 'all available options', 'every time available',
  'every available time', 'every slot', 'every available slot',
  'full list', 'list of times', 'list of slots',
  // "what / which / show / give me" + times/slots — asking to browse, not confirm
  'what times', 'which times', 'what slots', 'which slots',
  'show me the times', 'show me the slots', 'show me times',
  'give me the times', 'give me all', 'tell me the times',
  'can i see the times', 'can i see the slots', 'can i see all',
  'what are the times', 'what are the available times',
  'what are the slots', 'what are the available slots',
];

/** Phrases indicating the lead wants later/furthest available dates */
const FURTHER_DATE_PHRASES = [
  'further date', 'further dates',
  'furthest date', 'furthest available', 'furthest availability',
  'later date', 'later dates',
  'latest date', 'latest available', 'latest availability',
  'other dates', 'other date',
  'more dates', 'any more dates',
  'anything later', 'something later',
  'anything further', 'something further',
];

/**
 * Checks whether the message is asking for alternative/other options.
 * @returns true if the lead wants different slots than what was offered
 */
function detectOtherOptions(message: string): boolean {
  const lower = message.toLowerCase();
  return OTHER_OPTIONS_PHRASES.some(phrase => lower.includes(phrase));
}

/**
 * Checks whether the message is asking for later/further dates.
 * @returns true if the lead wants later slots
 */
function detectFurtherDate(message: string): boolean {
  const lower = message.toLowerCase();
  return FURTHER_DATE_PHRASES.some(phrase => lower.includes(phrase));
}

/**
 * Pattern for "further/another N week(s) from then/that/those/there".
 * This is a relative shift from the previously offered slots.
 */
const FURTHER_WEEK_FROM_PATTERN =
  /\b(?:further|another|an?\s+additional)\s+(\d+|one|two|three|four)\s+weeks?\s+(?:from|after|past)\s+(?:then|that|those|there|them)\b/i;

/**
 * Detects relative week-shift phrases like "a further one week from then".
 * Computes a date range starting N weeks after the latest offered slot.
 * @returns DateDetectionResult with computed range, or null
 */
function detectRelativeWeekShift(
  message: string,
  offeredSlots: OfferedSlotRef[],
): DateDetectionResult | null {
  const match = message.match(FURTHER_WEEK_FROM_PATTERN);
  if (!match || offeredSlots.length === 0) return null;

  const n = WORD_TO_NUM[match[1].toLowerCase()] ?? parseInt(match[1], 10);
  if (!(n > 0)) return null;

  // Find the latest offered slot date
  const latestDate = offeredSlots.reduce((latest, s) => {
    const d = new Date(s.dateTime);
    return d > latest ? d : latest;
  }, new Date(offeredSlots[0].dateTime));

  // Start of the week N weeks after the latest offered slot
  const dayOfWeek = latestDate.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const nextMondayAfterLatest = new Date(latestDate);
  nextMondayAfterLatest.setDate(latestDate.getDate() + daysUntilMonday);
  nextMondayAfterLatest.setHours(0, 0, 0, 0);

  // Shift by (n - 1) additional weeks since nextMonday is already 1 week out
  const start = new Date(nextMondayAfterLatest);
  start.setDate(nextMondayAfterLatest.getDate() + (n - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { startDate: start, endDate: end };
}

/**
 * Detects ordinal position words ("first", "second", "last") or numbered
 * references ("day 1", "option 2", "slot 3") in the message.
 * @returns 0-based index into the offered slots array, or null if not found
 */
function detectPosition(message: string, totalSlots: number): number | null {
  const lower = message.toLowerCase();

  // Check for numbered references: "day 1", "option 2", "slot 3", "number 1", "choice 2"
  const numberedMatch = lower.match(/\b(?:day|option|number|slot|choice)\s*(\d+)\b/);
  if (numberedMatch) {
    const num = parseInt(numberedMatch[1], 10);
    const idx = num - 1; // Convert 1-based to 0-based
    if (idx >= 0 && idx < totalSlots) return idx;
  }

  for (const [word, idx] of Object.entries(POSITIONAL_MAP)) {
    if (!lower.includes(word)) continue;
    const pos = lower.indexOf(word);
    // Avoid false positives:
    // - "first week of June" / "last month" → not a positional pick
    // - "31st" containing "1st" → not a positional pick (digit before match)
    const before = pos > 0 ? lower[pos - 1] : ' ';
    if (/\d/.test(before)) continue; // e.g. "31st" — digit before "1st"
    const after = lower.substring(pos + word.length).trimStart();
    if (/^week\b|^month\b/.test(after)) continue;
    return idx === -1 ? totalSlots - 1 : idx;
  }
  return null;
}

/**
 * Analyses a lead's reply against the list of previously offered slots and
 * returns a structured result describing the lead's intent.
 *
 * Detection priority (short-circuits on first match):
 *   NONE_SUITABLE → FURTHER_DATE → DIFFERENT_DATE → DIFFERENT_TIME →
 *   positional → day+time → day-only → time-only → AMBIGUOUS (all slots)
 *
 * @param message      - The lead's raw reply text
 * @param offeredSlots - The slots the AI previously presented to the lead
 */
export function detectSlotSelection(
  message: string,
  offeredSlots: OfferedSlotRef[],
): SlotSelectionResult {
  if (!offeredSlots.length) return { intent: 'NONE_SUITABLE' };
  const noneSuitable = detectNoneSuitable(message);
  // If the lead says "none of those" but also provides a new date preference
  // (e.g. "none work, how about August?"), prioritise the date preference
  if (noneSuitable) {
    const dateResult = detectDifferentDate(message);
    if (dateResult) {
      return {
        intent: 'DIFFERENT_DATE',
        requestedDate: dateResult.dayName,
        requestedStartDate: dateResult.startDate,
        requestedEndDate: dateResult.endDate,
      };
    }
    return { intent: 'NONE_SUITABLE' };
  }

  // --- "Other options" detection: must run before slot matching ---
  // Phrases like "what other times on Thursday" should NOT match as SLOT_SELECTED.
  // They indicate the lead wants alternative slots, possibly on a specific day.
  const lower = message.toLowerCase();
  const askingForOtherOptions = detectOtherOptions(message);
  if (askingForOtherOptions) {
    // Also detect a time-of-day preference (e.g. "other times, maybe in the afternoon")
    const otherTimePref = detectDifferentTime(message);

    // Handle "that date" / "that day" / "same day" — resolve from offered slots
    // MUST run before detectDifferentDate() because "same day" matches a generic
    // DATE_RANGE_PATTERN (today's date) rather than the offered slot's date.
    if (/\b(?:that|the same|this)\s+(?:date|day)\b/i.test(message) && offeredSlots.length > 0) {
      // Extract unique day names from currently offered slots
      const offeredDays = [...new Set(
        offeredSlots.map(s => extractDayFromDisplay(s.displayText)).filter(Boolean),
      )];
      if (offeredDays.length === 1) {
        // Only one date was offered — "that date" unambiguously refers to it
        const slot = offeredSlots[0];
        const dt = new Date(slot.dateTime);
        const start = new Date(dt);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        return {
          intent: 'DIFFERENT_DATE',
          requestedDate: offeredDays[0]!,
          requestedStartDate: start,
          requestedEndDate: end,
          ...(otherTimePref ? { timePreference: otherTimePref } : {}),
        };
      }
      // Multiple days offered — can't resolve "that date", ask for clarification
    }
    // Check for a specific date reference (e.g. "other times on Wednesday 1st April")
    // This must run before bare day-name matching so "1st April" isn't lost.
    const dateResult = detectDifferentDate(message);
    if (dateResult) {
      return {
        intent: 'DIFFERENT_DATE',
        requestedDate: dateResult.dayName,
        requestedStartDate: dateResult.startDate,
        requestedEndDate: dateResult.endDate,
        ...(otherTimePref ? { timePreference: otherTimePref } : {}),
      };
    }
    // Fall back to bare day name — "other times on Thursday"
    const dayForOther = DAY_NAMES.find(d => lower.includes(d.toLowerCase())) ?? null;
    if (dayForOther) {
      // If the lead mentioned a day name that matches an offered slot, resolve to
      // that slot's actual date so we fetch from the correct week (not last week's Friday).
      const matchingSlot = offeredSlots.find(
        s => extractDayFromDisplay(s.displayText)?.toLowerCase() === dayForOther.toLowerCase(),
      );
      if (matchingSlot) {
        const dt = new Date(matchingSlot.dateTime);
        const start = new Date(dt);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        return {
          intent: 'DIFFERENT_DATE',
          requestedDate: dayForOther,
          requestedStartDate: start,
          requestedEndDate: end,
          ...(otherTimePref ? { timePreference: otherTimePref } : {}),
        };
      }
      return { intent: 'DIFFERENT_DATE', requestedDate: dayForOther, ...(otherTimePref ? { timePreference: otherTimePref } : {}) };
    }

    // If only a time preference was expressed with no date (e.g. "any other times in the morning")
    // resolve to the offered slots' day if they're all on the same day
    if (otherTimePref && offeredSlots.length > 0) {
      const offeredDays = [...new Set(
        offeredSlots.map(s => extractDayFromDisplay(s.displayText)).filter(Boolean),
      )];
      if (offeredDays.length === 1) {
        const slot = offeredSlots[0];
        const dt = new Date(slot.dateTime);
        const start = new Date(dt);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        return {
          intent: 'DIFFERENT_DATE',
          requestedDate: offeredDays[0]!,
          requestedStartDate: start,
          requestedEndDate: end,
          timePreference: otherTimePref,
        };
      }
      // Multiple days — return as DIFFERENT_TIME so it filters across all days
      return { intent: 'DIFFERENT_TIME', timePreference: otherTimePref };
    }
    // No explicit date — but if the most recently offered slots are all on the
    // same day, the lead likely means "other times on THAT day" (e.g. they were
    // just shown a single Wednesday 15th slot and reply "any other times?").
    if (offeredSlots.length > 0) {
      const offeredDays = [...new Set(
        offeredSlots.map(s => extractDayFromDisplay(s.displayText)).filter(Boolean),
      )];
      if (offeredDays.length === 1) {
        const slot = offeredSlots[0];
        const dt = new Date(slot.dateTime);
        const start = new Date(dt);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        return {
          intent: 'DIFFERENT_DATE',
          requestedDate: offeredDays[0]!,
          requestedStartDate: start,
          requestedEndDate: end,
        };
      }
    }
    // Generic "other options" without a resolvable day — treat as none suitable
    // so the AI asks what dates/times work better
    return { intent: 'NONE_SUITABLE' };
  }

  // --- Early slot matching: try to match against offered slots FIRST ---
  // This prevents "Tuesday 1st September at 10am" from being misinterpreted
  // as a DIFFERENT_DATE (September) when it actually matches an offered slot.
  // Only triggers when the lead mentions a day name AND/OR an explicit time (with am/pm).
  // Bare numbers like "2" or "15" are NOT treated as times here to avoid
  // false positives on messages like "2 weeks from next week" or "on 15".
  const mentionedDay = DAY_NAMES.find(d => lower.includes(d.toLowerCase())) ?? null;
  const timeMatch = message.match(/\b(\d{1,2}(?:[.:]\d{2})?(?:am|pm))\b/i);
  const mentionedTime = timeMatch ? normaliseTime(timeMatch[1]) : null;

  if (mentionedDay && mentionedTime) {
    // Both day and explicit time — strong signal this is a slot confirmation
    let candidates = offeredSlots.filter(
      s => extractDayFromDisplay(s.displayText)?.toLowerCase() === mentionedDay.toLowerCase(),
    );
    const byTime = candidates.filter(s => extractTimeFromDisplay(s.displayText) === mentionedTime);
    if (byTime.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byTime[0] };
    if (byTime.length > 1) return { intent: 'AMBIGUOUS', ambiguousSlots: byTime };
    // Day matched but time didn't — try flipping am/pm
    const byFlipped = candidates.filter(s => extractTimeFromDisplay(s.displayText) === flipPeriod(mentionedTime));
    if (byFlipped.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byFlipped[0] };
    if (byFlipped.length > 1) return { intent: 'AMBIGUOUS', ambiguousSlots: byFlipped };
  }

  // Day name + date reference (e.g. "Monday 30th March") without a specific time —
  // if the day matches offered slots, try bare number time matching first, then
  // return AMBIGUOUS so the AI asks which time.
  // This prevents "starting on Monday 30th March" from being misinterpreted as DIFFERENT_DATE.
  if (mentionedDay && !mentionedTime) {
    // Match "27th March" (ordinal + month) OR "27th" after a day name (bare ordinal)
    const hasDateRef = /\d{1,2}(?:st|nd|rd|th)?\s*(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)/i.test(message)
      || /\b\d{1,2}(?:st|nd|rd|th)\b/i.test(message);
    if (hasDateRef) {
      const byDay = offeredSlots.filter(
        s => extractDayFromDisplay(s.displayText)?.toLowerCase() === mentionedDay.toLowerCase(),
      );
      // Try bare number time matching (e.g. "Friday 27th at 230" → 2:30pm)
      if (byDay.length > 1) {
        const earlyBareTime = message.match(/\b(\d{3,4}(?:am|pm)?)\b/i)
          || message.match(/\bat\s+(\d{1,2}(?:[.:]\d{2})?)\b/i);
        if (earlyBareTime) {
          const parsed = normaliseTime(earlyBareTime[1]);
          const byTime = byDay.filter(s => extractTimeFromDisplay(s.displayText) === parsed);
          if (byTime.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byTime[0] };
          // Also try flipping am/pm for bare numbers without explicit period
          if (!/(?:am|pm)/i.test(earlyBareTime[1])) {
            const byFlipped = byDay.filter(s => extractTimeFromDisplay(s.displayText) === flipPeriod(parsed));
            if (byFlipped.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byFlipped[0] };
          }
        }
      }
      if (byDay.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byDay[0] };
      if (byDay.length > 1) return { intent: 'AMBIGUOUS', ambiguousSlots: byDay };
    }
  }

  // --- Positional references ("the first one", "the 2nd") ---
  const position = detectPosition(message, offeredSlots.length);
  if (position !== null && position >= 0 && position < offeredSlots.length) {
    return { intent: 'SLOT_SELECTED', selectedSlot: offeredSlots[position] };
  }

  // --- Date/range detection for when the lead wants different slots ---
  // Check for relative week-shift phrases ("a further one week from then")
  const relativeShift = detectRelativeWeekShift(message, offeredSlots);
  if (relativeShift) {
    return {
      intent: 'DIFFERENT_DATE',
      requestedStartDate: relativeShift.startDate,
      requestedEndDate: relativeShift.endDate,
    };
  }

  // Check for date references — if the message contains both a "further/other dates"
  // phrase AND a specific date reference (e.g. "other dates on the first week of June"),
  // the date reference takes priority so we fetch the right range
  const dateResult = detectDifferentDate(message);
  if (dateResult) {
    return {
      intent: 'DIFFERENT_DATE',
      requestedDate: dateResult.dayName,
      requestedStartDate: dateResult.startDate,
      requestedEndDate: dateResult.endDate,
    };
  }

  // Only check for generic "further/other dates" when no specific date was detected above
  if (detectFurtherDate(message)) return { intent: 'FURTHER_DATE' };

  const timePreference = detectDifferentTime(message);
  if (timePreference) return { intent: 'DIFFERENT_TIME', timePreference };

  // --- Late slot matching: day-only, time-only, or bare number matching ---
  // This handles "Tuesday please", "The 4pm one", "9", "3:20", "1030" etc.
  const lateTimeMatch = message.match(/\b(\d{3,4}(?:am|pm)?)\b/i)
    || message.match(/\b(\d{1,2}(?:[.:]\d{2})?(?:am|pm)?)\b/i);
  const lateTime = lateTimeMatch ? normaliseTime(lateTimeMatch[1]) : null;
  const lateHasExplicitPeriod = lateTimeMatch ? /(?:am|pm)/i.test(lateTimeMatch[1]) : false;

  // Day-only matching (e.g. "Tuesday please")
  if (mentionedDay) {
    const byDay = offeredSlots.filter(
      s => extractDayFromDisplay(s.displayText)?.toLowerCase() === mentionedDay.toLowerCase(),
    );
    if (lateTime && byDay.length > 0) {
      const byDayTime = byDay.filter(s => extractTimeFromDisplay(s.displayText) === lateTime);
      if (byDayTime.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byDayTime[0] };
      if (byDayTime.length > 1) return { intent: 'AMBIGUOUS', ambiguousSlots: byDayTime };
    }
    if (byDay.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byDay[0] };
    if (byDay.length > 1) return { intent: 'AMBIGUOUS', ambiguousSlots: byDay };
  }

  // Time-only fallback when no day was mentioned
  if (lateTime) {
    const byTimeOnly = offeredSlots.filter(
      s => extractTimeFromDisplay(s.displayText) === lateTime,
    );
    if (byTimeOnly.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byTimeOnly[0] };
    if (byTimeOnly.length > 1)  return { intent: 'AMBIGUOUS', ambiguousSlots: byTimeOnly };

    if (!lateHasExplicitPeriod) {
      const byFlipped = offeredSlots.filter(
        s => extractTimeFromDisplay(s.displayText) === flipPeriod(lateTime),
      );
      if (byFlipped.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byFlipped[0] };
      if (byFlipped.length > 1)  return { intent: 'AMBIGUOUS', ambiguousSlots: byFlipped };
    }
  }

  // --- Confirmation phrases: when only 1 slot is offered and the lead
  // says something affirmative, auto-select that slot ---
  if (offeredSlots.length === 1) {
    const confirmPhrases = [
      /\bok\b/, /\bokay\b/, /\byes\b/, /\byeah\b/, /\byep\b/, /\byup\b/,
      /\bsure\b/, /\bsounds?\s*good\b/, /\bthat\s*(?:works|one)\b/,
      /\bbook\s*(?:it|that|me\s*in)\b/, /\bperfect\b/, /\bgreat\b/,
      /\bgo\s*(?:for|with|ahead)\b/, /\bplease\b/, /\bfine\b/,
      /\blet'?s?\s*(?:do|go)\b/, /\bconfirm\b/, /\bi'?ll\s*take\b/,
      /\bworks?\s*for\s*me\b/, /\bthat'?s?\s*(?:fine|good|great|perfect)\b/,
    ];
    if (confirmPhrases.some(p => p.test(lower))) {
      return { intent: 'SLOT_SELECTED', selectedSlot: offeredSlots[0] };
    }
  }

  return { intent: 'AMBIGUOUS', ambiguousSlots: offeredSlots };
}
