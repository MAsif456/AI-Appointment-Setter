'use client';

import type { ConversionFunnel } from '@/types/analytics';
import styles from './FunnelChart.module.css';

interface FunnelChartProps {
  /** Funnel stage counts. */
  funnel: ConversionFunnel;
}

/** Colour mapping for each funnel stage. */
const STAGE_COLOURS: Record<string, string> = {
  Leads: '#4361ee',
  Qualified: '#2ec4b6',
  'Booking Started': '#9b5de5',
  Booked: '#00b894',
};

/**
 * Horizontal bar chart showing the conversion funnel.
 * Uses CSS-based proportional bars for simplicity and reliability.
 */
export default function FunnelChart({ funnel }: FunnelChartProps) {
  const stages = [
    { label: 'Leads', value: funnel.leads },
    { label: 'Qualified', value: funnel.qualified },
    { label: 'Booking Started', value: funnel.bookingStarted },
    { label: 'Booked', value: funnel.booked },
  ];

  // Use the largest value as the denominator for proportional widths
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Conversion Funnel</h3>
      <div className={styles.funnel}>
        {stages.map((stage) => (
          <div key={stage.label} className={styles.row}>
            <span className={styles.label}>{stage.label}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${(stage.value / maxValue) * 100}%`,
                  backgroundColor: STAGE_COLOURS[stage.label],
                }}
                role="progressbar"
                aria-valuenow={stage.value}
                aria-valuemin={0}
                aria-valuemax={maxValue}
                aria-label={`${stage.label}: ${stage.value}`}
              />
            </div>
            <span className={styles.value}>{stage.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
