'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/Analytics/StatCard';
import ClinicInformation from './ClinicInformation';
import RecentConversations, { type RecentConversation } from '@/components/dashboard/RecentConversations';
import { fetchClinicAnalytics } from '@/lib/api/analytics';
import { fetchRecentConversations } from '@/lib/api/dashboard';
import type { ClinicAnalytics } from '@/types/analytics';
import type { Clinic } from '@/types/clinic';
import styles from './ClinicOverviewTab.module.css';

interface ClinicOverviewTabProps {
  /** The clinic whose overview we're rendering. */
  clinic: Clinic;
}

/** Resolves the ISO start/end for the "this month" (30-day) window. */
function resolveThisMonthRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/**
 * Overview tab content for the clinic detail page.
 *
 * Reuses the analytics endpoint for the four headline numbers, the
 * Clinic Information panel for static metadata, and the dashboard's
 * RecentConversations list scoped to this clinic. All three fetch in
 * parallel so the tab pops in a single render pass.
 */
export default function ClinicOverviewTab({ clinic }: ClinicOverviewTabProps) {
  const [analytics, setAnalytics] = useState<ClinicAnalytics | null>(null);
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { startDate, endDate } = resolveThisMonthRange();

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [stats, recent] = await Promise.all([
          fetchClinicAnalytics(clinic._id, { startDate, endDate }),
          fetchRecentConversations(3, clinic._id),
        ]);
        if (cancelled) return;
        setAnalytics(stats);
        setConversations(recent);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load overview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [clinic._id]);

  if (loading) return <p className={styles.loading}>Loading overview...</p>;
  if (error) return <p className={styles.error} role="alert">{error}</p>;

  return (
    <div className={styles.wrapper}>
      {analytics && (
        <div className={styles.statGrid}>
          <StatCard title="This Month's Leads" value={analytics.leads} />
          <StatCard title="This Month's Bookings" value={analytics.bookings} />
          <StatCard title="Conversion Rate" value={`${analytics.conversionRate}%`} />
          <StatCard title="Avg Messages to Booking" value={analytics.avgMessagesToBooking} />
        </div>
      )}

      <ClinicInformation clinic={clinic} />

      <RecentConversations
        conversations={conversations}
        viewAllHref={`/conversations?clinic=${encodeURIComponent(clinic.name)}`}
        hideClinic
      />
    </div>
  );
}
