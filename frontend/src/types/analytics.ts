/**
 * TypeScript interfaces for analytics API responses.
 * Mirrors the backend response DTOs exactly.
 */

/** A single data point for time-series charts. */
export interface DailyDataPoint {
  date: string;
  count: number;
}

/** Conversion funnel stage counts. */
export interface ConversionFunnel {
  leads: number;
  qualified: number;
  bookingStarted: number;
  booked: number;
}

/** Percentage change comparison against the previous period. */
export interface PeriodComparison {
  leadsChange: number;
  bookingsChange: number;
  conversionRateChange: number;
  avgResponseTimeChange: number;
}

/** Full response from GET /analytics/overview. */
export interface OverviewAnalytics {
  totalLeads: number;
  totalBookings: number;
  conversionRate: number;
  avgResponseTime: number;
  comparison: PeriodComparison;
  bookingsOverTime: DailyDataPoint[];
  conversionFunnel: ConversionFunnel;
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

/** Count of conversations in a specific phase. */
export interface PhaseCount {
  phase: string;
  count: number;
}

/** Lead acquisition source with count and percentage. */
export interface LeadSourceCount {
  source: string;
  count: number;
  percentage: number;
}

/** Full response from GET /analytics/clinics/:clinicId. */
export interface ClinicAnalytics {
  leads: number;
  bookings: number;
  conversionRate: number;
  avgResponseTime: number;
  bookingsOverTime: DailyDataPoint[];
  funnel: ConversionFunnel;
  conversationPhaseDistribution: PhaseCount[];
  leadSources: LeadSourceCount[];
  avgMessagesToBooking: number;
  declineRate: number;
}

/** Parameters for overview analytics requests. */
export interface OverviewParams {
  period?: string;
  startDate?: string;
  endDate?: string;
}

/** Parameters for date range filtering. */
export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}
