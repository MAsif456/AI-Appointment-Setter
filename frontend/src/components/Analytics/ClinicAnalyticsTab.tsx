'use client';

import { useState, useEffect } from 'react';
import type { ClinicAnalytics } from '@/types/analytics';
import { fetchClinicAnalytics } from '@/lib/api/analytics';
import StatCard from './StatCard';
import BookingsChart from './BookingsChart';
import PhaseDistribution from './PhaseDistribution';
import LeadSources from './LeadSources';
import styles from './ClinicAnalyticsTab.module.css';

interface ClinicAnalyticsTabProps {
  /** The clinic's MongoDB _id. */
  clinicId: string;
}

/**
 * Analytics tab content for the clinic detail page.
 * Fetches and displays clinic-specific analytics data.
 */
export default function ClinicAnalyticsTab({ clinicId }: ClinicAnalyticsTabProps) {
  const [data, setData] = useState<ClinicAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchClinicAnalytics(clinicId)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [clinicId]);

  if (loading) return <p className={styles.loading}>Loading analytics...</p>;
  if (error) return <p className={styles.error}>Error: {error}</p>;
  if (!data) return <p className={styles.loading}>No analytics data available.</p>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.statCards}>
        <StatCard title="This Month's Leads" value={data.leads} change={-1} />
        <StatCard title="This Month's Bookings" value={data.bookings} change={1} />
        <StatCard title="Conversion Rate" value={`${data.conversionRate}%`} />
        <StatCard title="Average Response Time" value={`${data.avgResponseTime} sec`} icon="clock" />
      </div>

      <BookingsChart data={data.bookingsOverTime} title="Bookings Over Time (Last 7 Days)" />
      <PhaseDistribution phases={data.conversationPhaseDistribution} />
      <LeadSources sources={data.leadSources} />
    </div>
  );
}
