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
