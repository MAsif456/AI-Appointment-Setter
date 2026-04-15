'use client';

import { useState } from 'react';
import styles from './DateRangeSelector.module.css';

interface DateRangeSelectorProps {
  /** Currently selected option label. */
  value: string;
  /** Callback when the selection changes. Receives the option label. */
  onChange: (value: string) => void;
  /** Callback when custom dates are set. */
  onCustomRange?: (startDate: string, endDate: string) => void;
}

/** Preset options for the date range dropdown. */
const OPTIONS = ['Last 7 days', 'Last 30 days', 'Custom range'] as const;

/**
 * Dropdown selector for choosing a date range period.
 * Supports preset ranges and a custom date picker.
 */
export default function DateRangeSelector({ value, onChange, onCustomRange }: DateRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    onChange(selected);
    setShowCustom(selected === 'Custom range');
  };

  // Apply custom date range when both dates are set
  const handleApply = () => {
    if (startDate && endDate && onCustomRange) {
      onCustomRange(startDate, endDate);
    }
  };

  return (
    <div className={styles.container}>
      <select
        className={styles.select}
        value={value}
        onChange={handleChange}
        aria-label="Select date range"
      >
        {OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>

      {showCustom && (
        <div className={styles.customRow}>
          <input
            type="date"
            className={styles.dateInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
          />
          <span className={styles.separator}>to</span>
          <input
            type="date"
            className={styles.dateInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
          />
          <button className={styles.applyButton} onClick={handleApply}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
