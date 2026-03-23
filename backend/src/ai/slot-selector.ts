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

/** Returns true if the message indicates none of the offered slots are suitable */
function detectNoneSuitable(message: string): boolean {
  const lower = message.toLowerCase();
  return NONE_SUITABLE_PHRASES.some(phrase => lower.includes(phrase));
}

/**
 * Checks whether the message is asking for a completely different date.
 * @returns Day name (e.g. "Friday") if detected, otherwise null
 */
function detectDifferentDate(message: string): string | null {
  const patterns = [
    /(?:anything|available|availability|slots?)\s+on\s+(\w+)/i,
    /(?:what about|how about)\s+(\w+)/i,
    /(?:on|for)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const day = DAY_NAMES.find(d => d.toLowerCase() === match[1].toLowerCase());
      if (day) return day;
    }
  }
  // Day mentioned in a question without a more specific pattern
  if (message.includes('?')) {
    for (const day of DAY_NAMES) {
      if (message.toLowerCase().includes(day.toLowerCase())) return day;
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
 *   NONE_SUITABLE → DIFFERENT_DATE → DIFFERENT_TIME → positional →
 *   day+time → day-only → time-only → AMBIGUOUS (all slots)
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

  const requestedDate = detectDifferentDate(message);
  if (requestedDate) return { intent: 'DIFFERENT_DATE', requestedDate };

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
