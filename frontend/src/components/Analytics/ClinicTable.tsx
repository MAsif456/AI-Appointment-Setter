'use client';

import type { ClinicComparisonRow } from '@/types/analytics';
import styles from './ClinicTable.module.css';

interface ClinicTableProps {
  /** Array of clinic comparison data rows. */
  clinics: ClinicComparisonRow[];
}

/**
 * Table component displaying clinic comparison metrics.
 * Shows leads, bookings, conversion rate, avg messages, and decline rate per clinic.
 */
export default function ClinicTable({ clinics }: ClinicTableProps) {
  if (clinics.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Clinic Comparison</h3>
        <p className={styles.empty}>No clinic data available.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Clinic Comparison</h3>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Clinic Name</th>
              <th className={styles.th}>Leads</th>
              <th className={styles.th}>Bookings</th>
              <th className={styles.th}>Conversion Rate</th>
              <th className={styles.th}>Avg Messages</th>
              <th className={styles.th}>Decline Rate</th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((clinic) => (
              <tr key={clinic.clinicId} className={styles.row}>
                <td className={styles.td}>{clinic.clinicName}</td>
                <td className={styles.td}>{clinic.leads}</td>
                <td className={styles.td}>{clinic.bookings}</td>
                <td className={styles.td}>{clinic.conversionRate}%</td>
                <td className={styles.td}>{clinic.avgMessages}</td>
                <td className={styles.td}>{clinic.declineRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
