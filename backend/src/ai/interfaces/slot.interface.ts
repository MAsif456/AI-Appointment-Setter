/**
 * Represents a single available appointment slot.
 */
export interface Slot {
  /**
   * Date of the appointment in ISO format (YYYY-MM-DD).
   */
  date: string;

  /**
   * Start time of the appointment in ISO format (HH:MM).
   */
  startTime: string;

  /**
   * End time of the appointment in ISO format (HH:MM).
   */
  endTime: string;
}

