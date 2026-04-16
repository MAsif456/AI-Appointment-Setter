/**
 * TypeScript interfaces for the overview analytics API response.
 * These define the shape of data returned by GET /analytics/overview.
 */

/** A single data point for time-series charts. */
export interface DailyDataPoint {
  /** Date in YYYY-MM-DD format. */
  date: string;
  /** Count of bookings on this date. */
  count: number;
}

/** Conversion funnel stage counts. */
export interface ConversionFunnel {
  /** Total number of leads (all conversations). */
  leads: number;
  /** Leads that passed qualification. */
  qualified: number;
  /** Leads that started the booking process. */
  bookingStarted: number;
  /** Leads that completed a booking. */
  booked: number;
}

/** Percentage change comparison against the previous period. */
export interface PeriodComparison {
  leadsChange: number;
  bookingsChange: number;
  conversionRateChange: number;
  avgMessagesToBookingChange: number;
}

/** Row in the clinic comparison table. */
export interface ClinicComparisonRow {
  clinicId: string;
  clinicName: string;
  leads: number;
  bookings: number;
  conversionRate: number;
  avgMessages: number;
  declineRate: number;
}

/** Full response from GET /analytics/overview. */
export interface OverviewResponse {
  totalLeads: number;
  totalBookings: number;
  conversionRate: number;
  avgMessagesToBooking: number;
  comparison: PeriodComparison;
  bookingsOverTime: DailyDataPoint[];
  conversionFunnel: ConversionFunnel;
}
