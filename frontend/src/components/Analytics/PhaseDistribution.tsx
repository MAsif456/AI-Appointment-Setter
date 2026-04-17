'use client';

import type { PhaseCount } from '@/types/analytics';
import styles from './PhaseDistribution.module.css';

interface PhaseDistributionProps {
  /** Array of conversation phase counts. */
  phases: PhaseCount[];
}

/**
 * Formats a phase name for display (e.g. 'bookingStarted' -> 'Booking Started').
 * Capitalises the first letter and inserts spaces before capitals.
 */
function formatPhaseName(phase: string): string {
  const spaced = phase.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Displays the distribution of conversations across different phases.
 * Renders each phase as a count badge in a grid layout.
 */
export default function PhaseDistribution({ phases }: PhaseDistributionProps) {
  if (phases.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Conversation Phase Distribution</h3>
        <p className={styles.empty}>No conversation data available.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Conversation Phase Distribution</h3>
      <div className={styles.grid}>
        {phases.map((item) => (
          <div key={item.phase} className={styles.badge}>
            <span className={styles.count}>{item.count}</span>
            <span className={styles.label}>{formatPhaseName(item.phase)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
