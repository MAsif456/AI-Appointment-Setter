'use client';

import styles from './StatCard.module.css';

interface StatCardProps {
  /** The metric label displayed above the value. */
  title: string;
  /** The main metric value to display. */
  value: string | number;
  /** Optional suffix appended to the value (e.g. 'sec', '%'). */
  suffix?: string;
  /** Optional percentage change indicator. Positive = green, negative = red. */
  change?: number;
}

/**
 * Reusable stat card component for displaying a single analytics metric.
 * Shows title, large value, and an optional trend indicator.
 */
export default function StatCard({ title, value, suffix, change }: StatCardProps) {
  // Determine the trend icon based on the change direction
  const getTrendIcon = () => {
    if (change === undefined || change === 0) return null;
    if (change > 0) return <span className={styles.trendUp}>&#x2197;</span>;
    return <span className={styles.trendDown}>&#x2198;</span>;
  };

  return (
    <div className={styles.card}>
      <p className={styles.title}>{title}</p>
      <div className={styles.valueRow}>
        <span className={styles.value}>
          {value}{suffix && <span className={styles.suffix}>{suffix}</span>}
        </span>
        {getTrendIcon()}
      </div>
    </div>
  );
}
