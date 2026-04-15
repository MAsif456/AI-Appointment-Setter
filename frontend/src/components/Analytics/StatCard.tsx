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
  /** Optional contextual label for the change (e.g. "vs yesterday"). */
  changeLabel?: string;
  /** Optional icon shown in the top-right of the card (e.g. clock, chat bubble). */
  icon?: React.ReactNode;
}

/**
 * Formats a percentage change value with the correct sign.
 * Returns null when there is nothing meaningful to show.
 */
function formatChange(change: number): string {
  const sign = change > 0 ? '+' : '';
  return `${sign}${change}%`;
}

/**
 * Reusable stat card component for displaying a single analytics metric.
 *
 * Renders in two modes:
 * - Simple mode (analytics page): title + value + trend arrow icon.
 * - Delta mode (dashboard): additionally shows a coloured "+X% vs yesterday"
 *   line at the bottom of the card when `change` and `changeLabel` are provided.
 */
export default function StatCard({ title, value, suffix, change, changeLabel, icon }: StatCardProps) {
  // The corner icon in the screenshots (activity chart, trending up/down, clock,
  // chat bubble) is rendered via the `icon` prop when supplied. When not
  // provided we fall back to the existing trend-arrow behaviour so that
  // AnalyticsPage continues to work unchanged.
  const renderTrendArrow = () => {
    if (change === undefined || change === 0) return null;
    if (change > 0) {
      return (
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" aria-hidden="true">
          <polyline points="4 16 8 12 12 14 20 6" />
          <polyline points="16 6 20 6 20 10" />
        </svg>
      );
    }
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" aria-hidden="true">
        <polyline points="4 8 8 12 12 10 20 18" />
        <polyline points="16 18 20 18 20 14" />
      </svg>
    );
  };

  // In delta mode we want to render the coloured "+X% vs yesterday" line.
  // Zero change is still rendered (as "0%") so staff can see that a metric
  // genuinely didn't move rather than assuming we forgot to fetch it.
  const renderChangeLabel = () => {
    if (change === undefined || !changeLabel) return null;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const ariaLabel = `${formatChange(change)} ${changeLabel}`;
    const deltaClass =
      direction === 'up'
        ? styles.deltaUp
        : direction === 'down'
          ? styles.deltaDown
          : styles.deltaFlat;
    return (
      <p className={styles.deltaRow} aria-label={ariaLabel}>
        <span className={deltaClass} aria-hidden="true">
          {direction === 'up' && '↗'}
          {direction === 'down' && '↘'}
          {direction === 'flat' && '→'}{' '}
          {formatChange(change)}
        </span>
        <span className={styles.deltaContext}> {changeLabel}</span>
      </p>
    );
  };

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <p className={styles.title}>{title}</p>
        {icon && <span className={styles.cornerIcon} aria-hidden="true">{icon}</span>}
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>
          {value}{suffix && <span className={styles.suffix}>{suffix}</span>}
        </span>
        {!icon && renderTrendArrow()}
      </div>
      {renderChangeLabel()}
    </div>
  );
}
