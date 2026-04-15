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
            <StatCard title={leadsLabel} value={data.leads} />
            <StatCard title={bookingsLabel} value={data.bookings} />
            <StatCard title="Conversion Rate" value={`${data.conversionRate}%`} />
            <StatCard title="Avg Messages to Booking" value={data.avgMessagesToBooking} />
          </div>

          <BookingsChart data={data.bookingsOverTime} title="Bookings Over Time" />
          <PhaseDistribution phases={data.conversationPhaseDistribution} />
          <LeadSources sources={data.leadSources} />
        </>
      )}
    </div>
  );
}
