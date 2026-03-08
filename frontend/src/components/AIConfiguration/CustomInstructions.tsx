'use client';

import styles from './CustomInstructions.module.css';

/** Props for the CustomInstructions component. */
interface CustomInstructionsProps {
  value: string;
  onChange: (instructions: string) => void;
}

/**
 * Textarea for adding free-form instructions that guide AI behaviour.
 * Includes a helper hint below explaining the purpose.
 */
export default function CustomInstructions({ value, onChange }: CustomInstructionsProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Custom Instructions</h2>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Add any special instructions for the AI..."
      />
      <p className={styles.hint}>
        Add any special instructions for the AI, e.g., &quot;Always mention free parking.&quot;
      </p>
    </section>
  );
}
