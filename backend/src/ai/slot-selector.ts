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
  'none of those', 'none of them', "don't work", 'dont work',
  'nothing works', 'not available', 'none work', "can't make any",
  'cant make any', 'none of these', "won't work", 'wont work',
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
function normaliseTime(raw: string): string {
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

/** Word-to-number map for week offset parsing */
const WORD_TO_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4,
  '1': 1, '2': 2, '3': 3, '4': 4,
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
  'this week', 'next week', 'same-day', 'same day',
  'tomorrow', 'flexible', 'wednesday', 'thursday',
  'saturday', 'tuesday', 'friday', 'sunday', 'monday',
  'morning', 'afternoon', 'evening',
  'urgent', 'today', 'weeks', 'asap', 'week',
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

/** Phrases indicating the lead wants later/furthest available dates */
const FURTHER_DATE_PHRASES = [
  'further date', 'further dates',
  'furthest date', 'furthest available',
  'later date', 'later dates',
  'latest date', 'latest available',
  'other dates', 'other date',
  'more dates', 'any more dates',
  'anything later', 'something later',
  'anything further', 'something further',
];

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
 * Detects ordinal position words ("first", "second", "last") in the message.
 * @returns 0-based index into the offered slots array, or null if not found
 */
function detectPosition(message: string, totalSlots: number): number | null {
  const lower = message.toLowerCase();
  for (const [word, idx] of Object.entries(POSITIONAL_MAP)) {
    if (lower.includes(word)) return idx === -1 ? totalSlots - 1 : idx;
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
  if (detectNoneSuitable(message)) return { intent: 'NONE_SUITABLE' };

  // Check for relative week-shift phrases ("a further one week from then")
  // before the generic FURTHER_DATE check, so we can compute the correct range
  const relativeShift = detectRelativeWeekShift(message, offeredSlots);
  if (relativeShift) {
    return {
      intent: 'DIFFERENT_DATE',
      requestedStartDate: relativeShift.startDate,
      requestedEndDate: relativeShift.endDate,
    };
  }

  // Check for "further/later dates" before date range detection
  // so "further dates this week" is caught as FURTHER_DATE
  if (detectFurtherDate(message)) return { intent: 'FURTHER_DATE' };

  const dateResult = detectDifferentDate(message);
  if (dateResult) {
    return {
      intent: 'DIFFERENT_DATE',
      requestedDate: dateResult.dayName,
      requestedStartDate: dateResult.startDate,
      requestedEndDate: dateResult.endDate,
    };
  }

  const timePreference = detectDifferentTime(message);
  if (timePreference) return { intent: 'DIFFERENT_TIME', timePreference };

  const position = detectPosition(message, offeredSlots.length);
  if (position !== null && position >= 0 && position < offeredSlots.length) {
    return { intent: 'SLOT_SELECTED', selectedSlot: offeredSlots[position] };
  }

  // Day and/or time keyword matching against offered slots
  const lower = message.toLowerCase();
  const mentionedDay = DAY_NAMES.find(d => lower.includes(d.toLowerCase())) ?? null;
  const timeMatch = message.match(/\b(\d{1,2}(?:[.:]\d{2})?(?:am|pm)?)\b/i);
  const mentionedTime = timeMatch ? normaliseTime(timeMatch[1]) : null;
  const hasExplicitPeriod = timeMatch ? /(?:am|pm)/i.test(timeMatch[1]) : false;

  let candidates = [...offeredSlots];
  if (mentionedDay) {
    candidates = candidates.filter(
      s => extractDayFromDisplay(s.displayText)?.toLowerCase() === mentionedDay.toLowerCase(),
    );
  }
  if (mentionedTime && candidates.length > 0) {
    const byTime = candidates.filter(s => extractTimeFromDisplay(s.displayText) === mentionedTime);
    if (byTime.length > 0) {
      candidates = byTime;
    } else if (!hasExplicitPeriod) {
      const byFlipped = candidates.filter(s => extractTimeFromDisplay(s.displayText) === flipPeriod(mentionedTime));
      if (byFlipped.length > 0) candidates = byFlipped;
    }
  }
  if (candidates.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: candidates[0] };
  if (candidates.length > 1)  return { intent: 'AMBIGUOUS', ambiguousSlots: candidates };

  // Time-only fallback when no day was mentioned
  if (mentionedTime) {
    const byTimeOnly = offeredSlots.filter(
      s => extractTimeFromDisplay(s.displayText) === mentionedTime,
    );
    if (byTimeOnly.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byTimeOnly[0] };
    if (byTimeOnly.length > 1)  return { intent: 'AMBIGUOUS', ambiguousSlots: byTimeOnly };

    if (!hasExplicitPeriod) {
      const byFlipped = offeredSlots.filter(
        s => extractTimeFromDisplay(s.displayText) === flipPeriod(mentionedTime),
      );
      if (byFlipped.length === 1) return { intent: 'SLOT_SELECTED', selectedSlot: byFlipped[0] };
      if (byFlipped.length > 1)  return { intent: 'AMBIGUOUS', ambiguousSlots: byFlipped };
    }
  }

  return { intent: 'AMBIGUOUS', ambiguousSlots: offeredSlots };
}
