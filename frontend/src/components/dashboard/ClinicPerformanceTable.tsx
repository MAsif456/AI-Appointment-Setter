'use client';

import { useRouter } from 'next/navigation';
import type { ClinicComparisonRow } from '@/types/analytics';
import styles from './ClinicPerformanceTable.module.css';

interface ClinicPerformanceTableProps {
  /** Rows returned from GET /analytics/clinics. */
  clinics: ClinicComparisonRow[];
  /** Optional map of clinic id -> isActive so we can render a status pill. */
  activeById?: Record<string, boolean>;
}

/**
 * Clinic Performance summary table shown on the staff dashboard.
 *
 * Unlike the richer Analytics Clinic Comparison table, this version is
 * trimmed to the columns the client requested in the dashboard design
 * (Name, Today's Leads, Today's Bookings, Conversion Rate, Status) and
 * is clickable — selecting a row routes to that clinic's detail page so
 * staff can drill down directly from the overview.
 */
export default function ClinicPerformanceTable({ clinics, activeById }: ClinicPerformanceTableProps) {
  const router = useRouter();

  const handleRowClick = (clinicId: string) => {
    router.push(`/clinics/${clinicId}`);
  };

  return (
    <section className={styles.card} aria-labelledby="clinic-performance-heading">
      <h2 id="clinic-performance-heading" className={styles.heading}>Clinic Performance</h2>

      {clinics.length === 0 ? (
        <p className={styles.empty}>No clinic data available yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Clinic Name</th>
              <th className={styles.th}>Today&apos;s Leads</th>
              <th className={styles.th}>Today&apos;s Bookings</th>
              <th className={styles.th}>Conversion Rate</th>
              <th className={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((row) => {
              // When activeById isn't supplied we default to treating the
              // clinic as active — the backend already excludes inactive
              // clinics from /analytics/clinics so any row that appears here
              // has been confirmed active server-side.
              const isActive = activeById ? activeById[row.clinicId] !== false : true;
              return (
                <tr
                  key={row.clinicId}
                  className={styles.row}
                  onClick={() => handleRowClick(row.clinicId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleRowClick(row.clinicId);
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`View details for ${row.clinicName}`}
                >
                  <td className={styles.td}>{row.clinicName}</td>
                  <td className={styles.td}>{row.leads}</td>
                  <td className={styles.td}>{row.bookings}</td>
                  <td className={styles.td}>{row.conversionRate}%</td>
                  <td className={styles.td}>
                    <span className={isActive ? styles.statusActive : styles.statusInactive}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
