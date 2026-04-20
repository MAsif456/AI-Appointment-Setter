'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OverviewAnalytics, ClinicComparisonRow } from '@/types/analytics';
import { fetchOverviewAnalytics, fetchClinicComparison } from '@/lib/api/analytics';
import StatCard from '@/components/Analytics/StatCard';
import DateRangeSelector from '@/components/Analytics/DateRangeSelector';
import BookingsChart from '@/components/Analytics/BookingsChart';
import FunnelChart from '@/components/Analytics/FunnelChart';
import ClinicTable from '@/components/Analytics/ClinicTable';
import styles from './Analytics.module.css';

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
 * Main analytics dashboard page.
 * Displays platform-wide metrics, bookings trend, conversion funnel, and clinic comparison.
 */
export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [clinics, setClinics] = useState<ClinicComparisonRow[]>([]);
  const [dateRange, setDateRange] = useState('Last 7 days');
  const [loading, setLoading] = useState(true);

  /** Maps the dropdown label to the API period parameter. */
  const getPeriod = useCallback((label: string) => {
    if (label === 'Last 30 days') return 'month';
    return 'week';
  }, []);

  /** Fetches overview data for the selected period. */
  const loadData = useCallback(async (period: string, startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      const [overviewData, clinicData] = await Promise.all([
        fetchOverviewAnalytics({ period, startDate, endDate }),
        fetchClinicComparison({ period, startDate, endDate }),
      ]);
      setOverview(overviewData);
      setClinics(clinicData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount and when date range changes
  useEffect(() => {
    if (dateRange !== 'Custom range') {
      loadData(getPeriod(dateRange));
    }
  }, [dateRange, loadData, getPeriod]);

  /** Handles custom date range application. */
  const handleCustomRange = (startDate: string, endDate: string) => {
    loadData('week', startDate, endDate);
  };

  if (loading && !overview) {
    return <div className={styles.page}><p className={styles.loading}>Loading analytics...</p></div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <DateRangeSelector
          value={dateRange}
          onChange={setDateRange}
          onCustomRange={handleCustomRange}
        />
      </div>

      {overview && (
        <>
          <div className={styles.statCards}>
            <StatCard title="Total Leads" value={overview.totalLeads} change={overview.comparison.leadsChange} icon={activityIcon} />
            <StatCard title="Total Bookings" value={overview.totalBookings} change={overview.comparison.bookingsChange} icon={trendUpIcon} />
            <StatCard title="Overall Conversion Rate" value={`${overview.conversionRate}%`} change={overview.comparison.conversionRateChange} icon={trendDownIcon} />
            <StatCard
              title="Avg Messages to Booking"
              value={overview.avgMessagesToBooking}
              change={overview.comparison.avgMessagesToBookingChange}
              icon={chatIcon}
            />
          </div>

          <BookingsChart data={overview.bookingsOverTime} />
          <FunnelChart funnel={overview.conversionFunnel} />
        </>
      )}

      <ClinicTable clinics={clinics} />
    </div>
  );
}
