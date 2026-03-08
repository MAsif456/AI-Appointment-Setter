'use client';

import styles from './EmptyState.module.css';

/** Props accepted by EmptyState. */
interface EmptyStateProps {
  hasSearch: boolean;
}

/**
 * Displays an appropriate empty-state message:
 * - "No clinics found" when a search returns zero results
 * - "No clinics configured yet" when the database is empty
 */
export default function EmptyState({ hasSearch }: EmptyStateProps) {
  if (hasSearch) {
    return (
      <div className={styles.container}>
        <p className={styles.message}>No clinics found</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <p className={styles.message}>No clinics configured yet</p>
      <button type="button" className={styles.addButton}>Add Clinic</button>
    </div>
  );
}
