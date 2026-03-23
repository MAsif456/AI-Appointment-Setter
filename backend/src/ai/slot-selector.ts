/**
 * Slot Selection Detector — analyses a lead's free-text reply and determines
 * which (if any) previously offered slot they have selected.
 * Uses keyword/pattern matching only, so results are deterministic and testable.
 */
import { SlotSelectionResult, SlotSelectionIntent, OfferedSlotRef } from './slot-selector.types';

export type { SlotSelectionResult, SlotSelectionIntent, OfferedSlotRef };

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
  const lower = raw.toLowerCase().trim();
  if (/^\d{1,2}(?::\d{2})?(?:am|pm)$/.test(lower)) return lower.replace(/^0/, '');
  const match24 = lower.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    const period = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
  }
  return lower;
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

/** Phrases that indicate a future date range, mapped to a resolver function */
const DATE_RANGE_PATTERNS: { pattern: RegExp; resolve: () => { start: Date; end: Date } }[] = [
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
function detectDifferentDate(message: string): DateDetectionResult | null {
  // Check for date range phrases first (more specific)
  for (const { pattern, resolve } of DATE_RANGE_PATTERNS) {
    if (pattern.test(message)) {
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
    const match = message.match(pattern);
    if (match) {
      const day = DAY_NAMES.find(d => d.toLowerCase() === match[1].toLowerCase());
      if (day) return { dayName: day };
    }
  }
  // Day mentioned in a question without a more specific pattern
  if (message.includes('?')) {
    for (const day of DAY_NAMES) {
      if (message.toLowerCase().includes(day.toLowerCase())) return { dayName: day };
    }
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
  const timeMatch = message.match(/\b(\d{1,2}(?::\d{2})?(?:am|pm)|\d{2}:\d{2})\b/i);
  const mentionedTime = timeMatch ? normaliseTime(timeMatch[1]) : null;

  let candidates = [...offeredSlots];
  if (mentionedDay) {
    candidates = candidates.filter(
      s => extractDayFromDisplay(s.displayText)?.toLowerCase() === mentionedDay.toLowerCase(),
    );
  }
  if (mentionedTime && candidates.length > 0) {
    const byTime = candidates.filter(s => extractTimeFromDisplay(s.displayText) === mentionedTime);
    if (byTime.length > 0) candidates = byTime;
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
  }

  return { intent: 'AMBIGUOUS', ambiguousSlots: offeredSlots };
}
