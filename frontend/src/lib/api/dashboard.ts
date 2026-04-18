/**
 * Dashboard-specific API client helpers.
 *
 * Thin composition layer over the analytics + conversations endpoints so
 * the dashboard page keeps a single-responsibility data boundary. Keeping
 * these calls here means the page component stays focused on rendering
 * and the individual fetch signatures are easier to mock in tests.
 */
import api from '@/lib/apiAxios';
import { fetchOverviewAnalytics, fetchClinicComparison } from './analytics';
import type { OverviewAnalytics, ClinicComparisonRow } from '@/types/analytics';
import type { RecentConversation } from '@/components/dashboard/RecentConversations';

/** Fetches today's platform overview — same shape as the analytics page. */
export function fetchDashboardOverview(): Promise<OverviewAnalytics> {
  return fetchOverviewAnalytics({ period: 'day' });
}

/** Fetches today's per-clinic performance rows. */
export function fetchDashboardClinics(): Promise<ClinicComparisonRow[]> {
  return fetchClinicComparison({ period: 'day' });
}

/**
 * Fetches the N most recent conversations, ordered by `lastMessageAt` DESC.
 * The backend currently returns all conversations; slicing happens here.
 *
 * @param limit - maximum number of conversations to return
 * @param clinicId - optional clinic id filter (used by clinic overview tab)
 */
export async function fetchRecentConversations(
  limit = 5,
  clinicId?: string,
): Promise<RecentConversation[]> {
  const response = await api.get<RecentConversation[]>('/conversations');
  const all = response.data;
  const filtered = clinicId
    ? all.filter((c) => c.clinicId?._id === clinicId)
    : all;
  // Sort by most recent message; fall back to createdAt so new rows still sort.
  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.lastMessageAt ?? a.createdAt ?? 0).getTime();
    const tb = new Date(b.lastMessageAt ?? b.createdAt ?? 0).getTime();
    return tb - ta;
  });
  return sorted.slice(0, limit);
}
