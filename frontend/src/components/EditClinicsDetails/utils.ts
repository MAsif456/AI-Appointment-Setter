export const DAYS_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/**
 * Capitalises the first letter of a lowercase day name.
 * @param day - Lowercase day string, e.g. "monday"
 * @returns Capitalised day string, e.g. "Monday"
 */
export function capitalizeDay(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}
