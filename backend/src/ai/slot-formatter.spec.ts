import { formatSlotDisplay, selectSlots, selectLatestSlots, buildSlotPromptSection, buildDayAvailabilitySection } from './slot-formatter';
import { Slot } from './interfaces/slot.interface';

describe('formatSlotDisplay', () => {
  it('should format a slot in British English with day, ordinal date, month and 12h time', () => {
    // 2026-03-17 is a Tuesday
    const slot: Slot = { date: '2026-03-17', startTime: '14:00', endTime: '14:30' };
    const result = formatSlotDisplay(slot);
    expect(result).toBe('Tuesday 17th March at 2pm');
  });

  it('should format morning times correctly with am', () => {
    // 2026-03-18 is a Wednesday
    const slot: Slot = { date: '2026-03-18', startTime: '10:00', endTime: '10:30' };
    expect(formatSlotDisplay(slot)).toBe('Wednesday 18th March at 10am');
  });

  it('should include minutes when time is not on the hour', () => {
    const slot: Slot = { date: '2026-03-17', startTime: '14:30', endTime: '15:00' };
    expect(formatSlotDisplay(slot)).toBe('Tuesday 17th March at 2:30pm');
  });

  it('should use 1st ordinal for day 1', () => {
    // 2026-03-01 is a Sunday
    const slot: Slot = { date: '2026-03-01', startTime: '09:00', endTime: '09:30' };
    expect(formatSlotDisplay(slot)).toContain('1st');
  });

  it('should use 2nd ordinal for day 2', () => {
    // 2026-03-02 is a Monday
    const slot: Slot = { date: '2026-03-02', startTime: '09:00', endTime: '09:30' };
    expect(formatSlotDisplay(slot)).toContain('2nd');
  });

  it('should use 3rd ordinal for day 3', () => {
    // 2026-03-03 is a Tuesday
    const slot: Slot = { date: '2026-03-03', startTime: '09:00', endTime: '09:30' };
    expect(formatSlotDisplay(slot)).toContain('3rd');
  });

  it('should use th for 11th, 12th, 13th (special cases)', () => {
    const slot11: Slot = { date: '2026-03-11', startTime: '09:00', endTime: '09:30' };
    const slot12: Slot = { date: '2026-03-12', startTime: '09:00', endTime: '09:30' };
    const slot13: Slot = { date: '2026-03-13', startTime: '09:00', endTime: '09:30' };
    expect(formatSlotDisplay(slot11)).toContain('11th');
    expect(formatSlotDisplay(slot12)).toContain('12th');
    expect(formatSlotDisplay(slot13)).toContain('13th');
  });

  it('should format 12:00 as 12pm not 0pm', () => {
    const slot: Slot = { date: '2026-03-17', startTime: '12:00', endTime: '12:30' };
    expect(formatSlotDisplay(slot)).toContain('12pm');
  });

  it('should never contain American date format (MM/DD)', () => {
    const slot: Slot = { date: '2026-03-17', startTime: '14:00', endTime: '14:30' };
    const result = formatSlotDisplay(slot);
    expect(result).not.toMatch(/\d{2}\/\d{2}/);
  });
});

describe('selectSlots', () => {
  const manySlots: Slot[] = [
    { date: '2026-03-17', startTime: '09:00', endTime: '09:30' },
    { date: '2026-03-17', startTime: '10:00', endTime: '10:30' },
    { date: '2026-03-17', startTime: '14:00', endTime: '14:30' },
    { date: '2026-03-18', startTime: '10:00', endTime: '10:30' },
    { date: '2026-03-18', startTime: '11:00', endTime: '11:30' },
    { date: '2026-03-19', startTime: '15:00', endTime: '15:30' },
    { date: '2026-03-20', startTime: '09:00', endTime: '09:30' },
    { date: '2026-03-21', startTime: '11:00', endTime: '11:30' },
    { date: '2026-03-22', startTime: '14:00', endTime: '14:30' },
    { date: '2026-03-23', startTime: '16:00', endTime: '16:30' },
  ];

  it('should return empty array when no slots provided', () => {
    expect(selectSlots([], 'urgent')).toEqual([]);
    expect(selectSlots([], 'routine')).toEqual([]);
    expect(selectSlots([], 'flexible')).toEqual([]);
  });

  it('should return earliest 3 slots for urgent leads', () => {
    const result = selectSlots(manySlots, 'urgent');
    expect(result).toHaveLength(3);
    // Should be the three earliest by date+time
    expect(result[0].startTime).toBe('09:00');
    expect(result[1].startTime).toBe('10:00');
    expect(result[2].startTime).toBe('14:00');
  });

  it('should spread across different days for routine leads', () => {
    const result = selectSlots(manySlots, 'routine');
    expect(result.length).toBeLessThanOrEqual(3);
    // All dates should be unique
    const dates = result.map((s) => s.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('should spread across different days for flexible leads', () => {
    const result = selectSlots(manySlots, 'flexible');
    expect(result.length).toBeLessThanOrEqual(3);
    const dates = result.map((s) => s.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('should cap at maximum 3 slots regardless of urgency', () => {
    expect(selectSlots(manySlots, 'urgent').length).toBeLessThanOrEqual(3);
    expect(selectSlots(manySlots, 'routine').length).toBeLessThanOrEqual(3);
    expect(selectSlots(manySlots, 'flexible').length).toBeLessThanOrEqual(3);
  });

  it('should return all slots when fewer than 3 are available', () => {
    const twoSlots: Slot[] = [
      { date: '2026-03-17', startTime: '14:00', endTime: '14:30' },
      { date: '2026-03-18', startTime: '10:00', endTime: '10:30' },
    ];
    expect(selectSlots(twoSlots, 'urgent')).toHaveLength(2);
    expect(selectSlots(twoSlots, 'routine')).toHaveLength(2);
  });

  it('should sort slots chronologically', () => {
    const unsorted: Slot[] = [
      { date: '2026-03-19', startTime: '15:00', endTime: '15:30' },
      { date: '2026-03-17', startTime: '14:00', endTime: '14:30' },
      { date: '2026-03-18', startTime: '10:00', endTime: '10:30' },
    ];
    const result = selectSlots(unsorted, 'urgent');
    expect(result[0].date).toBe('2026-03-17');
    expect(result[1].date).toBe('2026-03-18');
    expect(result[2].date).toBe('2026-03-19');
  });
});

describe('buildSlotPromptSection', () => {
  const threeSlots: Slot[] = [
    { date: '2026-03-17', startTime: '14:00', endTime: '14:30' },
    { date: '2026-03-18', startTime: '10:00', endTime: '10:30' },
    { date: '2026-03-19', startTime: '15:00', endTime: '15:30' },
  ];

  it('should include "fully booked" message when no slots available', () => {
    const result = buildSlotPromptSection([], 'routine');
    expect(result).toContain('fully booked');
    expect(result).toContain('different day');
  });

  it('should include formatted slot times for multiple slots', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).toContain('Tuesday 17th March at 2pm');
    expect(result).toContain('Wednesday 18th March at 10am');
    expect(result).toContain('Thursday 19th March at 3pm');
  });

  it('should include British English formatting rules', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).toContain('British English');
    expect(result).toContain('NEVER use American date format');
  });

  it('should add urgency emphasis for urgent leads', () => {
    const result = buildSlotPromptSection(threeSlots, 'urgent');
    expect(result).toContain('URGENCY');
    expect(result).toContain('earliest');
    expect(result).toContain('The earliest I can get you in is');
  });

  it('should NOT add urgency section for routine leads', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).not.toContain('URGENCY');
  });

  it('should handle single slot with specific phrasing', () => {
    const single: Slot[] = [
      { date: '2026-03-21', startTime: '11:00', endTime: '11:30' },
    ];
    const result = buildSlotPromptSection(single, 'routine');
    expect(result).toContain('Only ONE slot available');
    expect(result).toContain('does that work, or would you prefer a different time');
  });

  it('should offer multiple options naturally for 2+ slots', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).toContain('Offer these 3 options naturally');
    expect(result).toContain('Here are a few times I have available');
    expect(result).toContain('not the only available slots');
  });

  it('should include booking phase transition instruction', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).toContain('conversation phase moves to booking');
  });

  it('should include slot storage instruction', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).toContain('Store the offered slots');
  });

  it('should mention 4-month booking limit when no slots available', () => {
    const result = buildSlotPromptSection([], 'routine');
    expect(result).toContain('4 months');
  });
});

// ---------------------------------------------------------------------------
// selectLatestSlots — returns up to 3 slots from the latest available days
// ---------------------------------------------------------------------------
describe('selectLatestSlots', () => {
  const slotsAcrossDays: Slot[] = [
    { date: '2026-03-23', startTime: '09:00', endTime: '09:30' },
    { date: '2026-03-24', startTime: '10:00', endTime: '10:30' },
    { date: '2026-03-24', startTime: '14:00', endTime: '14:30' },
    { date: '2026-03-25', startTime: '11:00', endTime: '11:30' },
    { date: '2026-03-26', startTime: '15:00', endTime: '15:30' },
  ];

  it('should return empty array when no slots provided', () => {
    expect(selectLatestSlots([])).toEqual([]);
  });

  it('should return up to 3 slots from the latest days', () => {
    const result = selectLatestSlots(slotsAcrossDays);
    expect(result.length).toBeLessThanOrEqual(3);
    // The latest days are 26th, 25th, 24th
    expect(result[result.length - 1].date).toBe('2026-03-26');
  });

  it('should return slots in chronological order', () => {
    const result = selectLatestSlots(slotsAcrossDays);
    for (let i = 1; i < result.length; i++) {
      const prev = `${result[i - 1].date}T${result[i - 1].startTime}`;
      const curr = `${result[i].date}T${result[i].startTime}`;
      expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
    }
  });

  it('should pick one slot per day from the latest days', () => {
    const result = selectLatestSlots(slotsAcrossDays);
    const dates = result.map(s => s.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('should handle a single slot', () => {
    const result = selectLatestSlots([slotsAcrossDays[0]]);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-23');
  });
});

// ---------------------------------------------------------------------------
// buildDayAvailabilitySection — weekday availability overview
// ---------------------------------------------------------------------------
describe('buildDayAvailabilitySection', () => {
  // buildDayAvailabilitySection filters out past days at runtime, so the
  // range must always be in the future. Compute a Monday that is at least
  // two weeks ahead of today so the test is time-independent.
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const ordinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };
  const toDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const label = (d: Date, dayName: string): string =>
    `${dayName} ${ordinal(d.getDate())} ${MONTH_NAMES[d.getMonth()]}`;

  // Next Monday that is at least 14 days away — guarantees the whole week
  // is in the future regardless of when the test runs.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  const daysUntilMonday = (1 - monday.getDay() + 7) % 7 || 7;
  monday.setDate(monday.getDate() + daysUntilMonday + 14);

  const tuesday = new Date(monday); tuesday.setDate(monday.getDate() + 1);
  const wednesday = new Date(monday); wednesday.setDate(monday.getDate() + 2);
  const thursday = new Date(monday); thursday.setDate(monday.getDate() + 3);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const saturday = new Date(monday); saturday.setDate(monday.getDate() + 5);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

  const rangeStart = new Date(monday); rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(friday); rangeEnd.setHours(23, 59, 59, 999);

  const mondayLabel = label(monday, 'Monday');
  const tuesdayLabel = label(tuesday, 'Tuesday');
  const wednesdayLabel = label(wednesday, 'Wednesday');
  const thursdayLabel = label(thursday, 'Thursday');
  const fridayLabel = label(friday, 'Friday');

  const weekSlots: Slot[] = [
    { date: toDateStr(monday), startTime: '09:00', endTime: '09:30' },
    { date: toDateStr(tuesday), startTime: '10:00', endTime: '10:30' },
    { date: toDateStr(wednesday), startTime: '11:00', endTime: '11:30' },
    // Thursday and Friday have no slots — they should appear as fully booked
  ];

  it('should show available days with full dates when slots exist', () => {
    const result = buildDayAvailabilitySection(weekSlots, rangeStart, rangeEnd);
    expect(result).toContain('DAY AVAILABILITY');
    expect(result).toContain(mondayLabel);
    expect(result).toContain(tuesdayLabel);
    expect(result).toContain(wednesdayLabel);
  });

  it('should mention fully booked days with full dates', () => {
    const result = buildDayAvailabilitySection(weekSlots, rangeStart, rangeEnd);
    expect(result).toContain('Fully booked');
    expect(result).toContain(thursdayLabel);
    expect(result).toContain(fridayLabel);
  });

  it('should instruct AI not to offer specific times yet', () => {
    const result = buildDayAvailabilitySection(weekSlots, rangeStart, rangeEnd);
    expect(result).toContain('Do NOT offer specific times yet');
  });

  it('should return fully booked message when no slots available', () => {
    const result = buildDayAvailabilitySection([], rangeStart, rangeEnd);
    expect(result).toContain('No slots are currently available');
    expect(result).toContain('fully booked this week');
  });

  it('should not mention weekend days', () => {
    // Extend range to include Saturday/Sunday
    const extendedEnd = new Date(sunday); extendedEnd.setHours(23, 59, 59, 999);
    const result = buildDayAvailabilitySection(weekSlots, rangeStart, extendedEnd);
    expect(result).not.toContain('Saturday');
    expect(result).not.toContain('Sunday');
  });

  it('should include instruction to always use full dates', () => {
    const result = buildDayAvailabilitySection(weekSlots, rangeStart, rangeEnd);
    expect(result).toContain('Always include the full date alongside the day name');
  });
});
