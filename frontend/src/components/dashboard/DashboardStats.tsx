'use client';

import StatCard from '@/components/Analytics/StatCard';
import type { OverviewAnalytics } from '@/types/analytics';
import styles from './DashboardStats.module.css';

interface DashboardStatsProps {
  /** Overview response from the backend for today's period. */
  data: OverviewAnalytics;
}

/**
 * Four summary cards rendered at the top of the staff dashboard.
 *
 * Displays today's leads, bookings, conversion rate and average messages
 * to booking alongside a coloured "+X% vs yesterday" delta so staff can
 * spot movement at a glance. Uses the shared StatCard component in its
 * new delta-mode rather than duplicating the card markup.
 */
export default function DashboardStats({ data }: DashboardStatsProps) {
  const { totalLeads, totalBookings, conversionRate, avgMessagesToBooking, comparison } = data;

  // Simple inline SVGs for the corner icons — matches the designs in the
  // Figma reference (activity pulse, trending up, trending down, chat bubble).
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

  return (
    <div className={styles.grid}>
      <StatCard
        title="Today's Leads"
        value={totalLeads}
        change={comparison.leadsChange}
        changeLabel="vs yesterday"
        icon={activityIcon}
      />
      <StatCard
        title="Today's Bookings"
        value={totalBookings}
        change={comparison.bookingsChange}
        changeLabel="vs yesterday"
        icon={trendUpIcon}
      />
      <StatCard
        title="Conversion Rate"
        value={`${conversionRate}%`}
        change={comparison.conversionRateChange}
        changeLabel="vs yesterday"
        icon={trendDownIcon}
      />
      <StatCard
        title="Avg Messages to Booking"
        value={avgMessagesToBooking}
        change={comparison.avgMessagesToBookingChange}
        changeLabel="vs yesterday"
        icon={chatIcon}
      />
    </div>
  );
}
