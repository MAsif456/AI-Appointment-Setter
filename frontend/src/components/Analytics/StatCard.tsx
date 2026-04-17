'use client';

import styles from './StatCard.module.css';

interface StatCardProps {
  /** The metric label displayed above the value. */
  title: string;
  /** The main metric value to display. */
  value: string | number;
  /** Optional suffix appended to the value (e.g. '%'). */
  suffix?: string;
  /** Optional percentage change indicator. Positive = up trend, negative = down trend. */
  change?: number;
}

/**
 * Reusable stat card component for displaying a single analytics metric.
 * Shows the title, a large value, and a trend arrow when a change is provided.
 */
export default function StatCard({ title, value, suffix, change }: StatCardProps) {
  // Choose a trend arrow based on the sign of `change`; hide when zero/undefined.
  const renderIcon = () => {
    if (change === undefined || change === 0) return null;
    if (change > 0) {
      return (
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
          <polyline points="4 16 8 12 12 14 20 6" />
          <polyline points="16 6 20 6 20 10" />
        </svg>
      );
    }
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
        <polyline points="4 8 8 12 12 10 20 18" />
        <polyline points="16 18 20 18 20 14" />
      </svg>
    );
  };

  return (
    <div className={styles.card}>
      <p className={styles.title}>{title}</p>
      <div className={styles.valueRow}>
        <span className={styles.value}>
          {value}{suffix && <span className={styles.suffix}>{suffix}</span>}
        </span>
        {renderIcon()}
      </div>
    </div>
  );
}
