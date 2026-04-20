'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardStats from '@/components/dashboard/DashboardStats';
import ClinicPerformanceTable from '@/components/dashboard/ClinicPerformanceTable';
import RecentConversations, { type RecentConversation } from '@/components/dashboard/RecentConversations';
import {
  fetchDashboardOverview,
  fetchDashboardClinics,
  fetchRecentConversations,
} from '@/lib/api/dashboard';
import type { OverviewAnalytics, ClinicComparisonRow } from '@/types/analytics';
import styles from './page.module.css';

/** Formats today's date as "Monday, 2 March 2026" for the header. */
function formatToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Greets the user according to the local hour of the day. */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Staff overview dashboard — the landing page after login.
 *
 * Composes four feature panels: today's stat cards, the clinic
 * performance summary table (click-to-detail), and a recent-conversations
 * list. Data is fetched in parallel so the page renders in a single pass
 * and degrades gracefully if any endpoint fails.
 */
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [clinics, setClinics] = useState<ClinicComparisonRow[]>([]);
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Kick off all three fetches in parallel once the user is authenticated.
  // A single fetch failure fails the whole page so staff see a clear error
  // rather than partial data that could be misread as a genuine zero.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [ov, cl, rc] = await Promise.all([
          fetchDashboardOverview(),
          fetchDashboardClinics(),
          fetchRecentConversations(5),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setClinics(cl);
        setConversations(rc);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>{getGreeting()}, {user?.name ?? 'Admin User'}</p>
        </div>
        <span className={styles.date}>{formatToday()}</span>
      </header>

      {loading && <p className={styles.loading}>Loading dashboard...</p>}
      {error && <p className={styles.message} role="alert">{error}</p>}

      {!loading && !error && overview && (
        <>
          <DashboardStats data={overview} />
          <ClinicPerformanceTable clinics={clinics} />
          <RecentConversations conversations={conversations} />
        </>
      )}
    </div>
  );
}
