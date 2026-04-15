'use client';

import type { LeadSourceCount } from '@/types/analytics';
import styles from './LeadSources.module.css';

interface LeadSourcesProps {
  /** Array of lead source data with counts and percentages. */
  sources: LeadSourceCount[];
}

/**
 * Formats a lead source key for display (e.g. 'google_ads' -> 'Google Ads').
 */
function formatSourceName(source: string): string {
  return source
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Displays lead acquisition sources as horizontal progress bars.
 * Each bar shows the source name, count, and percentage of total leads.
 */
export default function LeadSources({ sources }: LeadSourcesProps) {
  if (sources.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Lead Sources</h3>
        <p className={styles.empty}>No lead source data available.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Lead Sources</h3>
      <div className={styles.list}>
        {sources.map((source) => (
          <div key={source.source} className={styles.row}>
            <div className={styles.header}>
              <span className={styles.sourceName}>{formatSourceName(source.source)}</span>
              <span className={styles.stats}>
                {source.count} ({source.percentage}%)
              </span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${source.percentage}%` }}
                role="progressbar"
                aria-valuenow={source.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${formatSourceName(source.source)}: ${source.percentage}%`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
