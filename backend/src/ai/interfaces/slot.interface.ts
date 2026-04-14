/**
 * Represents a single available appointment slot.
 */
export interface Slot {
  /**
   * Date of the appointment in YYYY-MM-DD format (UK local timezone).
   */
  date: string;

  /**
   * Start time in HH:MM (UK local timezone, e.g. "10:00" for 10am BST).
   */
  startTime: string;

  /**
   * End time in HH:MM (UK local timezone).
   */
  endTime: string;

  /**
   * Original UTC ISO 8601 string from GHL (e.g. "2026-04-10T09:00:00.000Z").
   * Used for accurate booking — do not reconstruct from date+startTime on a UTC server.
   */
  isoDateTime?: string;
}
