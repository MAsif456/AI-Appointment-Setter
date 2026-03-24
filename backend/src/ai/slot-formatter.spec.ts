import { formatSlotDisplay, selectSlots, buildSlotPromptSection } from './slot-formatter';
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
    expect(result).toContain('Does that work for you');
  });

  it('should offer multiple options naturally for 2+ slots', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).toContain('Offer these 3 options naturally');
    expect(result).toContain('Which works best for you');
  });

  it('should include booking phase transition instruction', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).toContain('conversation phase moves to booking');
  });

  it('should include slot storage instruction', () => {
    const result = buildSlotPromptSection(threeSlots, 'routine');
    expect(result).toContain('Store the offered slots');
  });
});
