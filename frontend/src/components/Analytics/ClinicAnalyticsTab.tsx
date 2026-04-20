'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ClinicAnalytics } from '@/types/analytics';
import { fetchClinicAnalytics } from '@/lib/api/analytics';
import StatCard from './StatCard';
import BookingsChart from './BookingsChart';
import DateRangeSelector from './DateRangeSelector';
import PhaseDistribution from './PhaseDistribution';
import LeadSources from './LeadSources';
import styles from './ClinicAnalyticsTab.module.css';

interface ClinicAnalyticsTabProps {
  /** The clinic's MongoDB _id. */
  clinicId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Resolves a preset label to an ISO start/end date pair. */
function resolvePreset(label: string): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const days = label === 'Last 30 days' ? 30 : 7;
  const start = new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);
  return { startDate: start, endDate: end };
}

// Inline SVG icons matching the dashboard stat cards
const activityIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const trendUpIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const trendDownIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);
const chatIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/**
 * Analytics tab content for the clinic detail page.
 *
 * Mirrors the main dashboard's date-range selector so staff/admins can
 * switch between Last 7 days, Last 30 days, or a custom range for a
 * single clinic's numbers. Resolves the preset client-side into explicit
 * start/end dates before calling the backend — the clinic endpoint only
 * accepts a custom range (no `period` param).
 */
export default function ClinicAnalyticsTab({ clinicId }: ClinicAnalyticsTabProps) {
  const [data, setData] = useState<ClinicAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('Last 7 days');

  const loadData = useCallback(
    async (startDate: string, endDate: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchClinicAnalytics(clinicId, { startDate, endDate });
        setData(result);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [clinicId],
  );

  useEffect(() => {
    if (dateRange !== 'Custom range') {
      const { startDate, endDate } = resolvePreset(dateRange);
      loadData(startDate, endDate);
    }
  }, [dateRange, loadData]);

  const handleCustomRange = (startDate: string, endDate: string) => {
    loadData(startDate, endDate);
  };

  const leadsLabel =
    dateRange === 'Last 30 days'
      ? 'Leads (30 days)'
      : dateRange === 'Custom range'
        ? 'Leads'
        : 'Leads (7 days)';
  const bookingsLabel = leadsLabel.replace('Leads', 'Bookings');

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <DateRangeSelector
          value={dateRange}
          onChange={setDateRange}
          onCustomRange={handleCustomRange}
        />
      </div>

      {loading && <p className={styles.loading}>Loading analytics...</p>}
      {error && <p className={styles.error}>Error: {error}</p>}

      {!loading && !error && data && (
        <>
          <div className={styles.statCards}>
            <StatCard title={leadsLabel} value={data.leads} icon={activityIcon} />
            <StatCard title={bookingsLabel} value={data.bookings} icon={trendUpIcon} />
            <StatCard title="Conversion Rate" value={`${data.conversionRate}%`} icon={trendDownIcon} />
            <StatCard title="Avg Messages to Booking" value={data.avgMessagesToBooking} icon={chatIcon} />
          </div>

          <BookingsChart data={data.bookingsOverTime} title="Bookings Over Time" />
          <PhaseDistribution phases={data.conversationPhaseDistribution} />
          <LeadSources sources={data.leadSources} />
        </>
      )}
    </div>
  );
}
