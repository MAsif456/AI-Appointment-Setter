/**
 * API client functions for analytics endpoints.
 * Uses the shared apiFetch helper for consistent error handling.
 */
import { apiFetch } from '../api';
import type {
  OverviewAnalytics,
  ClinicComparisonRow,
  ClinicAnalytics,
  OverviewParams,
  DateRangeParams,
} from '@/types/analytics';

/**
 * Fetches platform-wide analytics overview.
 * @param params - optional period or custom date range
 */
export async function fetchOverviewAnalytics(
  params?: OverviewParams,
): Promise<OverviewAnalytics> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', params.period);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);

  const qs = query.toString();
  return apiFetch<OverviewAnalytics>(`/analytics/overview${qs ? `?${qs}` : ''}`);
}

/**
 * Fetches comparison data for all active clinics.
 */
export async function fetchClinicComparison(): Promise<ClinicComparisonRow[]> {
  return apiFetch<ClinicComparisonRow[]>('/analytics/clinics');
}

/**
 * Fetches detailed analytics for a single clinic.
 * @param clinicId - the clinic's MongoDB _id
 * @param params - optional custom date range
 */
export async function fetchClinicAnalytics(
  clinicId: string,
  params?: DateRangeParams,
): Promise<ClinicAnalytics> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);

  const qs = query.toString();
  return apiFetch<ClinicAnalytics>(`/analytics/clinics/${clinicId}${qs ? `?${qs}` : ''}`);
}
