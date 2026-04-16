/**
 * Shared constants for the analytics module.
 * Contains funnel phase mappings and date-range helpers.
 */

/** Phases that indicate a lead has been qualified or progressed further. */
export const QUALIFIED_PHASES = [
  'qualified', 'booking', 'booked', 'confirmed',
];

/** Phases that indicate a lead has started the booking process. */
export const BOOKING_STARTED_PHASES = [
  'booking', 'booked', 'confirmed',
];

/** Phases that indicate a lead has completed a booking. */
export const BOOKED_PHASES = ['booked', 'confirmed'];

/** Phases considered as declined conversations. */
export const DECLINED_PHASES = ['declined'];

/** Valid booking statuses counted as successful appointments. */
export const VALID_BOOKING_STATUSES = ['confirmed', 'completed', 'rescheduled'];

/**
 * Computes start and end dates for a given period relative to today.
 * @param period - 'week' for last 7 days, 'month' for last 30 days
 * @returns Object with startDate and endDate as Date objects
 */
export function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  if (period === 'month') {
    startDate.setDate(startDate.getDate() - 29);
  } else {
    // Default to 'week' (last 7 days)
    startDate.setDate(startDate.getDate() - 6);
  }

  return { startDate, endDate };
}

/**
 * Computes the previous period's date range for comparison.
 * @param startDate - current period start
 * @param endDate - current period end
 * @returns Object with previous period's startDate and endDate
 */
export function getPreviousPeriodRange(
  startDate: Date,
  endDate: Date,
): { startDate: Date; endDate: Date } {
  const durationMs = endDate.getTime() - startDate.getTime();

  const prevEnd = new Date(startDate.getTime() - 1);
  prevEnd.setHours(23, 59, 59, 999);

  const prevStart = new Date(prevEnd.getTime() - durationMs);
  prevStart.setHours(0, 0, 0, 0);

  return { startDate: prevStart, endDate: prevEnd };
}

/**
 * Calculates percentage change between two values.
 * Returns 0 when the previous value is zero to avoid division errors.
 * @param current - current period value
 * @param previous - previous period value
 * @returns percentage change rounded to one decimal place
 */
export function calcPercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
