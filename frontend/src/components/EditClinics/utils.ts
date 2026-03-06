export const DAYS_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function capitalizeDay(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}
