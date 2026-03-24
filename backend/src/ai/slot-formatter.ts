import { Slot } from './interfaces/slot.interface';

/**
 * Returns a string representing the day of the month in an ordinal
 * format (e.g. 1st, 2nd, 3rd, etc.).
 * @param day - The day of the month to format.
 * @returns A string representing the day of the month in an ordinal
 * format.
 */
function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${day}${suffixes[day % 10] || 'th'}`;
}

/**
 * Converts a time in 24-hour format to a 12-hour format string.
 * @param time24 - The time in 24-hour format (HH:MM).
 * @returns A string representing the time in 12-hour format (HH:MM AM/PM).
 */
function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  return minutes === 0 ? `${hour12}${period}` : `${hour12}:${minutes}${period}`;
}

/**
 * Array of day names, in order.
 * @example ['Sunday', 'Monday', 'Tuesday', ...]
 */
const DAYS: string[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
];

/**
 * Array of month names, in order.
 * @example ['January', 'February', 'March', ...]
 */
const MONTHS: string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Formats a slot into a human-readable string for display.
 * @param slot - The slot to format.
 * @returns A string representing the slot in a human-readable format.
 * @example
 * const slot = {
 *   date: '2026-03-17',
 *   startTime: '14:00',
 * };
 * const formatted = formatSlotDisplay(slot);
 * console.log(formatted); // 'Thursday 17th March at 2:00 pm'
 */
export function formatSlotDisplay(slot: Slot): string {
  const date = new Date(`${slot.date}T${slot.startTime}:00`);
  const dayName = DAYS[date.getDay()];
  const dayNum = ordinal(date.getDate());
  const monthName = MONTHS[date.getMonth()];
  const time = formatTime(slot.startTime);
  return `${dayName} ${dayNum} ${monthName} at ${time}`;
}


/**
 * Selects a subset of slots based on the urgency level.
 * - urgent: returns the first 3 slots (earliest possible).
 * - routine: returns one slot per day from the first 3 available days.
 * - flexible: spreads 3 slots across the available range (early, mid, late)
 *   to give the lead a variety of dates and times.
 * @param slots - The slots to select from.
 * @param urgency - The urgency level.
 * @returns A subset of slots selected based on the urgency level.
 */
export function selectSlots(
  slots: Slot[],
  urgency: 'urgent' | 'routine' | 'flexible',
): Slot[] {
  if (slots.length === 0) return [];

  const sorted = [...slots].sort((a, b) => {
    const dateA = `${a.date}T${a.startTime}`;
    const dateB = `${b.date}T${b.startTime}`;
    return dateA.localeCompare(dateB);
  });

  if (urgency === 'urgent') {
    return sorted.slice(0, 3);
  }

  // Get unique days
  const uniqueDays: string[] = [];
  for (const slot of sorted) {
    if (!uniqueDays.includes(slot.date)) uniqueDays.push(slot.date);
  }

  if (urgency === 'flexible' && uniqueDays.length >= 3) {
    // Cap the spread to 28 days (4 weeks) from the first available day
    // so that options feel relevant rather than spanning months apart
    const firstDate = new Date(uniqueDays[0]);
    const maxDate = new Date(firstDate);
    maxDate.setDate(firstDate.getDate() + 28);
    const cappedDays = uniqueDays.filter(d => new Date(d) <= maxDate);
    const spreadDays = cappedDays.length >= 3 ? cappedDays : uniqueDays.slice(0, Math.min(uniqueDays.length, 10));

    const earlyDay = spreadDays[0];
    const midDay = spreadDays[Math.floor(spreadDays.length / 2)];
    const lateDay = spreadDays[spreadDays.length - 1];

    const pickFromDay = (day: string): Slot => {
      const daySlots = sorted.filter(s => s.date === day);
      // Pick a midday slot for variety rather than always the earliest
      return daySlots[Math.floor(daySlots.length / 2)];
    };

    return [pickFromDay(earlyDay), pickFromDay(midDay), pickFromDay(lateDay)];
  }

  // routine or flexible with fewer than 3 days: one slot per day, max 3
  const byDay = new Map<string, Slot>();
  for (const slot of sorted) {
    if (!byDay.has(slot.date) && byDay.size < 3) {
      byDay.set(slot.date, slot);
    }
  }
  return Array.from(byDay.values());
}

/**
 * Selects up to 3 slots spread across the latest available days.
 * Used when the lead asks for "further dates" or "the furthest date".
 * @param slots - All available slots
 * @returns Up to 3 slots from the latest days
 */
export function selectLatestSlots(slots: Slot[]): Slot[] {
  if (slots.length === 0) return [];

  const sorted = [...slots].sort((a, b) => {
    const dateA = `${a.date}T${a.startTime}`;
    const dateB = `${b.date}T${b.startTime}`;
    return dateB.localeCompare(dateA); // latest first
  });

  const byDay = new Map<string, Slot>();
  for (const slot of sorted) {
    if (!byDay.has(slot.date) && byDay.size < 3) {
      byDay.set(slot.date, slot);
    }
  }
  // Return in chronological order
  return Array.from(byDay.values()).reverse();
}


/**
 * Builds a prompt section string for the Groq API based on available slots.
 * The prompt instructs the AI to act as a clinic receptionist without revealing
 * that it is an AI or disclosing any model information.
 * @param slots - The available slots to offer to the patient
 * @param urgency - The urgency level of the patient
 * @returns A formatted prompt string ready to send to the AI
 */
export function buildSlotPromptSection(
  slots: Slot[],
  urgency: 'urgent' | 'routine' | 'flexible',
): string {
  if (slots.length === 0) {
    return [
      '=== AVAILABLE SLOTS ===',
      'No slots are currently available for the requested date.',
      'Tell the lead we are fully booked on that date.',
      'Ask if they would like to try a different day, a different week, or a specific month.',
      'We can book appointments up to 6 months in advance.',
    ].join('\n');
  }

  const formatted = slots.map(formatSlotDisplay);
  const lines: string[] = [
    '=== AVAILABLE SLOTS ===',
    `Available times: ${formatted.join(', ')}`,
    '',
    'FORMATTING RULES:',
    '- Use British English date format (day name + ordinal + month)',
    '- Use 12-hour time with am/pm (e.g. 2pm, 10am)',
    '- NEVER use American date format (MM/DD/YYYY)',
    '- Present slots conversationally, not as a list',
    '- ONLY offer the exact slots listed above — do NOT invent or suggest dates/times not shown here',
  ];

  if (urgency === 'urgent') {
    lines.push(
      '',
      'URGENCY: This lead is urgent.',
      `- Mention the earliest slot first: "${formatted[0]}"`,
      '- Emphasise urgency, e.g. "The earliest I can get you in is..."',
    );
  }

  if (slots.length === 1) {
    lines.push(
      '',
      `Only ONE slot available: "${formatted[0]}"`,
      '- Say something like: "I have [slot] available. Does that work for you?"',
    );
  } else {
    lines.push(
      '',
      `Offer these ${slots.length} options naturally.`,
      '- e.g. "I have [slot1], [slot2], or [slot3]. Which works best for you?"',
    );
  }

  lines.push(
    '',
    'IMPORTANT: When you offer slots, the conversation phase moves to booking.',
    'Store the offered slots for later selection matching.',
  );

  return lines.join('\n');
}
