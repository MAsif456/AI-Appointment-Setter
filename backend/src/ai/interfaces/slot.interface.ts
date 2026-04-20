/**
 * Represents a single available appointment slot.
 */
export interface Slot {
  /**
   * Date of the appointment in ISO format (YYYY-MM-DD), as displayed in
   * clinic-local time (Europe/London). Use `dateTime` for any UTC-sensitive
   * operation (booking, storage) to avoid BST/GMT round-trip errors.
   */
  date: string;

  /**
   * Start time of the appointment in ISO format (HH:MM), in clinic-local
   * time (Europe/London). Display-only — see `dateTime` for the UTC value.
   */
  startTime: string;

  /**
   * End time of the appointment in ISO format (HH:MM), clinic-local.
   */
  endTime: string;

  /**
   * Authoritative UTC instant of the slot, as returned by GHL, in ISO 8601
   * with `Z` suffix. Preserved end-to-end so booking uses the exact timestamp
   * GHL offered, rather than a display-string round-trip.
   */
  dateTime?: string;
}
