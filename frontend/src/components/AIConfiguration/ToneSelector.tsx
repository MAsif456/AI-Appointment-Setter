'use client';

import styles from './ToneSelector.module.css';
import { AITone } from '@/types/clinic';

/** Props for the ToneSelector component. */
interface ToneSelectorProps {
  value: AITone;
  onChange: (tone: AITone) => void;
}

/** Metadata for each available tone option. */
const toneOptions: { value: AITone; label: string; description: string }[] = [
  { value: 'friendly', label: 'Friendly', description: 'Warm and casual, uses emojis sparingly' },
  { value: 'professional', label: 'Professional', description: 'Formal and businesslike' },
  { value: 'balanced', label: 'Balanced', description: 'Mix of friendly and professional' },
];

/**
 * Radio group for selecting the AI conversation tone.
 * Renders each tone option with a label and description.
 */
export default function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Tone</h2>
      <div className={styles.options}>
        {toneOptions.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name="tone"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className={styles.radio}
            />
            <div className={styles.optionContent}>
              <span className={styles.optionLabel}>{option.label}</span>
              <span className={styles.optionDescription}>{option.description}</span>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
