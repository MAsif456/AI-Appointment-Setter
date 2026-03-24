/**
 * Tests for the slot-selector module.
 *
 * Each acceptance-criteria scenario from User Story #18 is covered by at least
 * one test, plus additional edge-case tests for robustness.
 */
import { detectSlotSelection, OfferedSlotRef } from './slot-selector';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** Three slots on different days — used by the majority of AC tests */
const THREE_DISTINCT_DAYS: OfferedSlotRef[] = [
  { dateTime: '2026-03-24T14:00:00', displayText: 'Tuesday 24th March at 2pm' },
  { dateTime: '2026-03-25T10:00:00', displayText: 'Wednesday 25th March at 10am' },
  { dateTime: '2026-03-26T15:00:00', displayText: 'Thursday 26th March at 3pm' },
];

/** Two slots on the same day at different times — used for ambiguity tests */
const TWO_TUESDAY_SLOTS: OfferedSlotRef[] = [
  { dateTime: '2026-03-24T14:00:00', displayText: 'Tuesday 24th March at 2pm' },
  { dateTime: '2026-03-24T16:00:00', displayText: 'Tuesday 24th March at 4pm' },
  { dateTime: '2026-03-25T10:00:00', displayText: 'Wednesday 25th March at 10am' },
];

// ---------------------------------------------------------------------------
// AC1: "Tuesday please" → single Tuesday slot → SLOT_SELECTED Tuesday 2pm
// ---------------------------------------------------------------------------
describe('AC1 – single day match', () => {
  it('matches "Tuesday please" to the only Tuesday slot', () => {
    const result = detectSlotSelection('Tuesday please', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });
});

// ---------------------------------------------------------------------------
// AC2: "The 4pm one" → two Tuesday slots → SLOT_SELECTED Tuesday 4pm
// ---------------------------------------------------------------------------
describe('AC2 – time-only match', () => {
  it('matches "The 4pm one" to the correct slot by time', () => {
    const result = detectSlotSelection('The 4pm one', TWO_TUESDAY_SLOTS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 4pm');
  });
});

// ---------------------------------------------------------------------------
// AC3: "Wednesday at 10am works" → SLOT_SELECTED Wednesday 10am
// ---------------------------------------------------------------------------
describe('AC3 – day + time match', () => {
  it('matches "Wednesday at 10am works" to the correct slot', () => {
    const result = detectSlotSelection('Wednesday at 10am works', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Wednesday 25th March at 10am');
  });
});

// ---------------------------------------------------------------------------
// AC4: "Tuesday" with two Tuesday slots → AMBIGUOUS
// ---------------------------------------------------------------------------
describe('AC4 – ambiguous day match', () => {
  it('returns AMBIGUOUS with both Tuesday slots when day alone is ambiguous', () => {
    const result = detectSlotSelection('Tuesday', TWO_TUESDAY_SLOTS);
    expect(result.intent).toBe('AMBIGUOUS');
    expect(result.ambiguousSlots).toHaveLength(2);
    const texts = result.ambiguousSlots!.map(s => s.displayText);
    expect(texts).toContain('Tuesday 24th March at 2pm');
    expect(texts).toContain('Tuesday 24th March at 4pm');
  });
});

// ---------------------------------------------------------------------------
// AC5: "Do you have anything on Friday?" → DIFFERENT_DATE "Friday"
// ---------------------------------------------------------------------------
describe('AC5 – different date intent', () => {
  it('detects DIFFERENT_DATE and extracts "Friday"', () => {
    const result = detectSlotSelection('Do you have anything on Friday?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedDate).toBe('Friday');
  });

  it('detects DIFFERENT_DATE for "What about Monday?"', () => {
    const result = detectSlotSelection('What about Monday?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedDate).toBe('Monday');
  });
});

// ---------------------------------------------------------------------------
// AC6: "Do you have anything earlier in the morning?" → DIFFERENT_TIME "morning"
// ---------------------------------------------------------------------------
describe('AC6 – different time-of-day intent', () => {
  it('detects DIFFERENT_TIME with preference "morning"', () => {
    const result = detectSlotSelection(
      'Do you have anything earlier in the morning?',
      THREE_DISTINCT_DAYS,
    );
    expect(result.intent).toBe('DIFFERENT_TIME');
    expect(result.timePreference).toBe('morning');
  });

  it('detects DIFFERENT_TIME for "anything in the afternoon?"', () => {
    const result = detectSlotSelection('Do you have anything in the afternoon?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_TIME');
    expect(result.timePreference).toBe('afternoon');
  });

  it('detects DIFFERENT_TIME for "something earlier"', () => {
    const result = detectSlotSelection('Do you have something earlier?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_TIME');
    expect(result.timePreference).toBe('earlier');
  });
});

// ---------------------------------------------------------------------------
// AC7: "yeah the first one" → SLOT_SELECTED Tuesday 2pm (index 0)
// ---------------------------------------------------------------------------
describe('AC7 – positional selection', () => {
  it('matches "yeah the first one" to the first offered slot', () => {
    const result = detectSlotSelection('yeah the first one', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });

  it('matches "the second one" to the second offered slot', () => {
    const result = detectSlotSelection('the second one', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Wednesday 25th March at 10am');
  });

  it('matches "the last one" to the final offered slot', () => {
    const result = detectSlotSelection('the last one', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Thursday 26th March at 3pm');
  });
});

// ---------------------------------------------------------------------------
// AC8: "None of those work for me" → NONE_SUITABLE
// ---------------------------------------------------------------------------
describe('AC8 – none suitable', () => {
  it('returns NONE_SUITABLE for "None of those work for me"', () => {
    const result = detectSlotSelection('None of those work for me', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('NONE_SUITABLE');
  });

  it('returns NONE_SUITABLE for "None of them work"', () => {
    const result = detectSlotSelection('None of them work', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('NONE_SUITABLE');
  });

  it('returns NONE_SUITABLE for "I\'m not available for any of those"', () => {
    const result = detectSlotSelection("I'm not available for any of those", THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('NONE_SUITABLE');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('returns NONE_SUITABLE when no slots were offered', () => {
    const result = detectSlotSelection('Tuesday please', []);
    expect(result.intent).toBe('NONE_SUITABLE');
  });

  it('is case-insensitive for day names', () => {
    const result = detectSlotSelection('tuesday please', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });

  it('normalises 24-hour time format for matching', () => {
    const slot: OfferedSlotRef = {
      dateTime: '2026-03-24T14:00:00',
      displayText: 'Tuesday 24th March at 2pm',
    };
    const result = detectSlotSelection('I can do 14:00', [slot]);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });

  it('matches dot-separated time like "9.20" to 9:20am slot', () => {
    const slots: OfferedSlotRef[] = [
      { dateTime: '2026-03-23T09:00:00', displayText: 'Monday 23rd March at 9am' },
      { dateTime: '2026-03-23T09:10:00', displayText: 'Monday 23rd March at 9:10am' },
      { dateTime: '2026-03-23T09:20:00', displayText: 'Monday 23rd March at 9:20am' },
    ];
    const result = detectSlotSelection('9.20', slots);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Monday 23rd March at 9:20am');
  });

  it('matches bare number "9" to 9am slot', () => {
    const slots: OfferedSlotRef[] = [
      { dateTime: '2026-03-23T09:00:00', displayText: 'Monday 23rd March at 9am' },
      { dateTime: '2026-03-23T10:00:00', displayText: 'Monday 23rd March at 10am' },
    ];
    const result = detectSlotSelection('9', slots);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Monday 23rd March at 9am');
  });

  it('matches "3:20" without am/pm to 3:20pm slot by flipping period', () => {
    const slots: OfferedSlotRef[] = [
      { dateTime: '2026-03-23T14:00:00', displayText: 'Monday 23rd March at 2pm' },
      { dateTime: '2026-03-23T15:20:00', displayText: 'Monday 23rd March at 3:20pm' },
      { dateTime: '2026-03-23T16:00:00', displayText: 'Monday 23rd March at 4pm' },
    ];
    const result = detectSlotSelection('3:20', slots);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Monday 23rd March at 3:20pm');
  });

  it('returns AMBIGUOUS with all slots when message cannot be matched', () => {
    const result = detectSlotSelection('sounds good', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('AMBIGUOUS');
    expect(result.ambiguousSlots).toHaveLength(THREE_DISTINCT_DAYS.length);
  });

  it('matches "3rd" as positional reference to the third slot', () => {
    const result = detectSlotSelection('the 3rd', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Thursday 26th March at 3pm');
  });
});

// ---------------------------------------------------------------------------
// Time-only fallback (lines 172-180) — when day filtering yields no
// candidates but the message contains a recognisable time
// ---------------------------------------------------------------------------
describe('time-only fallback when day filter produces no matches', () => {
  it('selects a slot by time alone when a non-matching day is mentioned', () => {
    // User says "Monday at 2pm" but no Monday slots exist — only Tuesday has 2pm
    const result = detectSlotSelection('Monday at 2pm', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });

  it('returns AMBIGUOUS via time fallback when multiple slots share the same time', () => {
    const sameTimeSlots: OfferedSlotRef[] = [
      { dateTime: '2026-03-24T10:00:00', displayText: 'Tuesday 24th March at 10am' },
      { dateTime: '2026-03-25T10:00:00', displayText: 'Wednesday 25th March at 10am' },
      { dateTime: '2026-03-26T15:00:00', displayText: 'Thursday 26th March at 3pm' },
    ];
    // "Monday at 10am" — Monday matches nothing, time fallback finds two 10am slots
    const result = detectSlotSelection('Monday at 10am', sameTimeSlots);
    expect(result.intent).toBe('AMBIGUOUS');
    expect(result.ambiguousSlots).toHaveLength(2);
    expect(result.ambiguousSlots!.every(s => s.displayText.includes('10am'))).toBe(true);
  });

  it('falls back to AMBIGUOUS with all slots when nothing matches at all', () => {
    // "Monday at 8am" — neither day nor time matches any offered slot
    const result = detectSlotSelection('Monday at 8am', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('AMBIGUOUS');
    expect(result.ambiguousSlots).toHaveLength(THREE_DISTINCT_DAYS.length);
  });
});

// ---------------------------------------------------------------------------
// extractTimeFromDisplay integration — verifies the regex works with real
// formatSlotDisplay() output formats
// ---------------------------------------------------------------------------
describe('extractTimeFromDisplay works with formatSlotDisplay output', () => {
  it('parses time from a standard "Day Nth Month at Xpm" display text', () => {
    // These are the exact format produced by formatSlotDisplay()
    const slots: OfferedSlotRef[] = [
      { dateTime: '2026-03-24T14:00:00', displayText: 'Tuesday 24th March at 2pm' },
      { dateTime: '2026-03-25T10:00:00', displayText: 'Wednesday 25th March at 10am' },
    ];
    // "the 2pm one" should match via time extraction from display text
    const result = detectSlotSelection('the 2pm one', slots);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });

  it('parses time with minutes from display text like "at 2:30pm"', () => {
    const slots: OfferedSlotRef[] = [
      { dateTime: '2026-03-24T14:30:00', displayText: 'Tuesday 24th March at 2:30pm' },
      { dateTime: '2026-03-25T10:00:00', displayText: 'Wednesday 25th March at 10am' },
    ];
    const result = detectSlotSelection('2:30pm', slots);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2:30pm');
  });
});

// ---------------------------------------------------------------------------
// "N weeks from next week" — compound date range detection
// ---------------------------------------------------------------------------
describe('N weeks from next week', () => {
  it('detects "2 weeks from next week" as DIFFERENT_DATE with correct range', () => {
    const result = detectSlotSelection('it has to be 2 weeks from next week', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedEndDate).toBeDefined();
    // Start should be 2 weeks after next Monday (≈ 3 weeks from now)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const expectedStart = new Date(today);
    expectedStart.setDate(today.getDate() + daysUntilMonday + 14);
    expectedStart.setHours(0, 0, 0, 0);
    expect(result.requestedStartDate!.getTime()).toBe(expectedStart.getTime());
  });

  it('handles typo "2 week ffroom next week"', () => {
    const result = detectSlotSelection('My bad it has to be 2 week ffroom next week', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });

  it('handles "two weeks from next week" with word number', () => {
    const result = detectSlotSelection('two weeks from next week', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });

  it('does not match plain "next week" with this pattern', () => {
    const result = detectSlotSelection('How about next week?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    // Should use the simple "next week" pattern, not the compound one
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const expectedStart = new Date(today);
    expectedStart.setDate(today.getDate() + daysUntilMonday);
    expectedStart.setHours(0, 0, 0, 0);
    expect(result.requestedStartDate!.getTime()).toBe(expectedStart.getTime());
  });
});

// ---------------------------------------------------------------------------
// "a further N week(s) from then" — relative shift from last offered slots
// ---------------------------------------------------------------------------
describe('relative week shift from offered slots', () => {
  // Offered slots in the week of April 13-17 (as in the real scenario)
  const APRIL_WEEK_SLOTS: OfferedSlotRef[] = [
    { dateTime: '2026-04-13T13:20:00', displayText: 'Monday 13th April at 1:20pm' },
    { dateTime: '2026-04-15T13:20:00', displayText: 'Wednesday 15th April at 1:20pm' },
    { dateTime: '2026-04-17T13:20:00', displayText: 'Friday 17th April at 1:20pm' },
  ];

  /** Helper to get local YYYY-MM-DD from a Date (avoids UTC timezone shift) */
  function localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('detects "a further one week from then" as DIFFERENT_DATE in the week of April 20', () => {
    const result = detectSlotSelection(
      'I need it to be a further one week from then',
      APRIL_WEEK_SLOTS,
    );
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedEndDate).toBeDefined();
    // Latest offered slot is Friday April 17. Next Monday after that is April 20.
    // n=1 so start = April 20 (the next Monday), end = April 27
    expect(localDateStr(result.requestedStartDate!)).toBe('2026-04-20');
    expect(localDateStr(result.requestedEndDate!)).toBe('2026-04-27');
  });

  it('detects "another two weeks from that"', () => {
    const result = detectSlotSelection(
      'another two weeks from that',
      APRIL_WEEK_SLOTS,
    );
    expect(result.intent).toBe('DIFFERENT_DATE');
    // n=2: next Monday (April 20) + 1 extra week = April 27, end = May 4
    expect(localDateStr(result.requestedStartDate!)).toBe('2026-04-27');
    expect(localDateStr(result.requestedEndDate!)).toBe('2026-05-04');
  });

  it('detects "a further 1 week from those"', () => {
    const result = detectSlotSelection(
      'a further 1 week from those',
      APRIL_WEEK_SLOTS,
    );
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(localDateStr(result.requestedStartDate!)).toBe('2026-04-20');
  });

  it('does not trigger on plain "further date" (no week number)', () => {
    const result = detectSlotSelection('further date please', APRIL_WEEK_SLOTS);
    expect(result.intent).toBe('FURTHER_DATE');
  });
});

// ---------------------------------------------------------------------------
// Garbled input tolerance — keywords buried in junk characters
// ---------------------------------------------------------------------------
describe('garbled input tolerance', () => {
  it('detects "this week" in "this weekqaq"', () => {
    const result = detectSlotSelection('this weekqaq', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });

  it('detects "today" in "ADSJHatodaysdjhbkasd"', () => {
    const result = detectSlotSelection('ADSJHatodaysdjhbkasd', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });

  it('detects "week" in "adfjjbdfjbweekfdasfbdkbd"', () => {
    // "week" alone doesn't trigger a date range, but the cleaning shouldn't break
    const result = detectSlotSelection('adfjjbdfjbweekfdasfbdkbd', THREE_DISTINCT_DAYS);
    // No specific date range expected, just shouldn't crash
    expect(result).toBeDefined();
  });

  it('detects "flexible" in "jkadflexiblehjksd"', () => {
    // "flexible" is not a date range keyword for detectDifferentDate,
    // but the cleaning should handle it without breaking
    const result = detectSlotSelection('jkadflexiblehjksd', THREE_DISTINCT_DAYS);
    expect(result).toBeDefined();
  });

  it('preserves "weeks" in "2 weeks from next week"', () => {
    const result = detectSlotSelection('it has to be 2 weeks from next week', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Date-of-month references (e.g. "on the 30th", "the 15th")
// ---------------------------------------------------------------------------
describe('Date-of-month detection', () => {
  it('detects "on the 30th" as DIFFERENT_DATE with a single-day range', () => {
    const result = detectSlotSelection('I would like it on the 30th', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedEndDate).toBeDefined();
    // The range should span exactly 1 day
    const diffMs = result.requestedEndDate!.getTime() - result.requestedStartDate!.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
    // The start date should be on the 30th
    expect(result.requestedStartDate!.getDate()).toBe(30);
  });

  it('detects "the 15th" as DIFFERENT_DATE targeting the 15th', () => {
    const result = detectSlotSelection('the 15th', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate!.getDate()).toBe(15);
  });

  it('detects "on 4th" as DIFFERENT_DATE targeting the 4th', () => {
    const result = detectSlotSelection('on 4th', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate!.getDate()).toBe(4);
  });

  it('picks next month if the date has already passed this month', () => {
    // Use a date that is definitely in the past (the 1st, unless today is the 1st)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pastDay = today.getDate() > 1 ? 1 : null;
    if (pastDay) {
      // We need a day >= 4 to avoid the positional exclusion
      const testDay = Math.max(today.getDate() - 1, 4);
      if (testDay < today.getDate()) {
        const result = detectSlotSelection(`on the ${testDay}th`, THREE_DISTINCT_DAYS);
        expect(result.intent).toBe('DIFFERENT_DATE');
        expect(result.requestedStartDate!.getMonth()).toBe(today.getMonth() + 1 > 11 ? 0 : today.getMonth() + 1);
      }
    }
  });

  it('detects "on the 30" (no ordinal suffix) as DIFFERENT_DATE targeting the 30th', () => {
    const result = detectSlotSelection('on the 30', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate!.getDate()).toBe(30);
  });

  it('detects "on 15" (no ordinal suffix, no "the") as DIFFERENT_DATE targeting the 15th', () => {
    const result = detectSlotSelection('I want it on 15', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate!.getDate()).toBe(15);
  });

  it('does not treat "the 1st one" as a date-of-month reference', () => {
    const result = detectSlotSelection('the 1st one', THREE_DISTINCT_DAYS);
    // Should be SLOT_SELECTED (positional), not DIFFERENT_DATE
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });

  it('does not treat "the 2nd" as a date-of-month (positional selector)', () => {
    const result = detectSlotSelection('the 2nd', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Wednesday 25th March at 10am');
  });
});

// ---------------------------------------------------------------------------
// normaliseTime — 24-hour bare numbers (lines 74-79)
// ---------------------------------------------------------------------------
describe('normaliseTime — 24-hour bare numbers', () => {
  it('matches bare "14" to a 2pm slot', () => {
    const slots: OfferedSlotRef[] = [
      { dateTime: '2026-03-24T14:00:00', displayText: 'Tuesday 24th March at 2pm' },
    ];
    const result = detectSlotSelection('14', slots);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });
});

// ---------------------------------------------------------------------------
// flipPeriod — am→pm and pm→am (lines 84-86)
// ---------------------------------------------------------------------------
describe('flipPeriod — am/pm flipping', () => {
  it('flips "2pm" to "2am" when no exact match and selects via flipped period', () => {
    const slots: OfferedSlotRef[] = [
      { dateTime: '2026-03-24T02:00:00', displayText: 'Tuesday 24th March at 2am' },
      { dateTime: '2026-03-25T10:00:00', displayText: 'Wednesday 25th March at 10am' },
    ];
    // User says "Tuesday at 2pm" but only 2am exists — early matching flips and finds it
    const result = detectSlotSelection('Tuesday at 2pm', slots);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2am');
  });
});

// ---------------------------------------------------------------------------
// DATE_RANGE_PATTERNS — "in two weeks", "tomorrow", "next month", "this month"
// (lines 162-197)
// ---------------------------------------------------------------------------
describe('DATE_RANGE_PATTERNS coverage', () => {
  it('detects "in two weeks" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('how about in two weeks?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });

  it('detects "tomorrow" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('can I come in tomorrow?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(result.requestedStartDate!.getDate()).toBe(tomorrow.getDate());
  });

  it('detects "next month" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('next month please', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    const nextMonth = new Date();
    expect(result.requestedStartDate!.getMonth()).toBe(nextMonth.getMonth() + 1);
  });

  it('detects "this month" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('anything this month?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedStartDate!.getMonth()).toBe(new Date().getMonth());
  });
});

// ---------------------------------------------------------------------------
// Week-of-month detection (lines 308-344)
// ---------------------------------------------------------------------------
describe('week-of-month detection', () => {
  it('detects "first week of June" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('first week of June', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedStartDate!.getMonth()).toBe(5); // June = 5
  });

  it('detects "last week of April" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('last week of April', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedStartDate!.getMonth()).toBe(3); // April = 3
  });

  it('detects "second week of May" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('second week of May', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedStartDate!.getMonth()).toBe(4); // May = 4
  });

  it('detects "3rd week of July" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('3rd week of July', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedStartDate!.getMonth()).toBe(6); // July = 6
  });
});

// ---------------------------------------------------------------------------
// Week-only detection without month name (lines 355-387)
// ---------------------------------------------------------------------------
describe('week-only detection (no month name)', () => {
  it('detects "the first week" as DIFFERENT_DATE defaulting to next month', () => {
    const result = detectSlotSelection('the first week', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });

  it('detects "the last week" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('the last week', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });

  it('detects "fourth week" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('fourth week', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// "in N months" detection (lines 394-399)
// ---------------------------------------------------------------------------
describe('in N months detection', () => {
  it('detects "in 2 months" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('in 2 months', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    const expected = new Date();
    expect(result.requestedStartDate!.getMonth()).toBe(expected.getMonth() + 2);
  });

  it('detects "in three months" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('in three months', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Month name detection (lines 407-417)
// ---------------------------------------------------------------------------
describe('month name detection', () => {
  it('detects "in April" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('anything in April?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedStartDate!.getMonth()).toBe(3); // April = 3
  });

  it('detects "sometime in June" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('sometime in June', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate!.getMonth()).toBe(5); // June = 5
  });

  it('detects abbreviated month "Jul" as DIFFERENT_DATE', () => {
    const result = detectSlotSelection('how about Jul?', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate!.getMonth()).toBe(6); // July = 6
  });
});

// ---------------------------------------------------------------------------
// Invalid date-of-month rollover (lines 437, 445-450)
// ---------------------------------------------------------------------------
describe('date-of-month invalid day rollover', () => {
  it('handles "on the 31st" by finding next month with 31 days', () => {
    const result = detectSlotSelection('on the 31st', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    expect(result.requestedStartDate).toBeDefined();
    expect(result.requestedStartDate!.getDate()).toBe(31);
  });
});

// ---------------------------------------------------------------------------
// Day+date matching against offered slots (lines 644-648)
// ---------------------------------------------------------------------------
describe('day name + date reference matching offered slots', () => {
  it('"starting on Tuesday 24th March" matches offered Tuesday slots as AMBIGUOUS', () => {
    const result = detectSlotSelection('starting on Tuesday 24th March', TWO_TUESDAY_SLOTS);
    expect(result.intent).toBe('AMBIGUOUS');
    expect(result.ambiguousSlots).toHaveLength(2);
  });

  it('"Monday 30th March" with single Monday slot returns SLOT_SELECTED', () => {
    const mondaySlots: OfferedSlotRef[] = [
      { dateTime: '2026-03-30T10:30:00', displayText: 'Monday 30th March at 10:30am' },
      { dateTime: '2026-03-31T13:20:00', displayText: 'Tuesday 31st March at 1:20pm' },
    ];
    const result = detectSlotSelection('Monday 30th March', mondaySlots);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Monday 30th March at 10:30am');
  });
});

// ---------------------------------------------------------------------------
// detectPosition skips "week"/"month" (lines 593-596)
// ---------------------------------------------------------------------------
describe('detectPosition skips week/month phrases', () => {
  it('"first week of August" does NOT select the first slot', () => {
    const result = detectSlotSelection('first week of August', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('DIFFERENT_DATE');
    // Should detect as week-of-month, not positional
  });

  it('"last month" does NOT select the last slot', () => {
    const result = detectSlotSelection('last month', THREE_DISTINCT_DAYS);
    // Should not be SLOT_SELECTED via positional "last"
    expect(result.intent).not.toBe('SLOT_SELECTED');
  });
});

// ---------------------------------------------------------------------------
// Late slot matching — day+time in late block (lines 700-702)
// ---------------------------------------------------------------------------
describe('late slot matching — day with implicit time', () => {
  it('"Tuesday 2" matches Tuesday at 2pm via late matching', () => {
    const result = detectSlotSelection('Tuesday 2', THREE_DISTINCT_DAYS);
    expect(result.intent).toBe('SLOT_SELECTED');
    expect(result.selectedSlot?.displayText).toBe('Tuesday 24th March at 2pm');
  });
});

// ---------------------------------------------------------------------------
// Time-only flipped period AMBIGUOUS (line 721)
// ---------------------------------------------------------------------------
describe('flipped period AMBIGUOUS in late matching', () => {
  it('returns AMBIGUOUS when flipped time matches multiple slots', () => {
    const slots: OfferedSlotRef[] = [
      { dateTime: '2026-03-24T02:00:00', displayText: 'Tuesday 24th March at 2am' },
      { dateTime: '2026-03-25T02:00:00', displayText: 'Wednesday 25th March at 2am' },
    ];
    // User says "2pm" but only 2am slots exist — flip finds two
    const result = detectSlotSelection('2pm', slots);
    expect(result.intent).toBe('AMBIGUOUS');
    expect(result.ambiguousSlots).toHaveLength(2);
  });
});
