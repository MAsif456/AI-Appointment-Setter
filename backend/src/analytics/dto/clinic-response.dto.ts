/**
 * TypeScript interfaces for the per-clinic analytics API response.
 * Defines the shape of data returned by GET /analytics/clinics/:clinicId.
 */
import { DailyDataPoint, ConversionFunnel } from './overview-response.dto';

/** Count of conversations in a specific phase. */
export interface PhaseCount {
  /** Conversation phase name (e.g. 'greeting', 'qualified'). */
  phase: string;
  /** Number of conversations in this phase. */
  count: number;
}

/** Lead acquisition source with count and percentage. */
export interface LeadSourceCount {
  /** Source name (e.g. 'facebook', 'google_ads'). */
  source: string;
  /** Number of leads from this source. */
  count: number;
  /** Percentage of total leads from this source. */
  percentage: number;
}

/** Full response from GET /analytics/clinics/:clinicId. */
export interface ClinicAnalyticsResponse {
  leads: number;
  bookings: number;
  conversionRate: number;
  bookingsOverTime: DailyDataPoint[];
  funnel: ConversionFunnel;
  conversationPhaseDistribution: PhaseCount[];
  leadSources: LeadSourceCount[];
  avgMessagesToBooking: number;
  declineRate: number;
}
