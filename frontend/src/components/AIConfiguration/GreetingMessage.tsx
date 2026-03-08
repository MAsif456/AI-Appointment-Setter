'use client';

import styles from './GreetingMessage.module.css';

/** Props for the GreetingMessage component. */
interface GreetingMessageProps {
  value: string;
  onChange: (message: string) => void;
}

/** Template variables that staff can insert into greetings. */
const availableVariables = ['{{firstName}}', '{{lastName}}', '{{issue}}', '{{clinicName}}'];

/**
 * Textarea for editing the AI greeting template.
 * Shows available template variables below the input.
 */
export default function GreetingMessage({ value, onChange }: GreetingMessageProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Greeting Message</h2>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Enter your greeting template..."
      />
      <p className={styles.hint}>
        Available variables: {availableVariables.map((v, i) => (
          <span key={v}>
            <code className={styles.variable}>{v}</code>
            {i < availableVariables.length - 1 && ', '}
          </span>
        ))}
      </p>
    </section>
  );
}
