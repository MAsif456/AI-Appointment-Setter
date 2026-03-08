'use client';

import styles from './SaveBar.module.css';

/** Props for the SaveBar component. */
interface SaveBarProps {
  onSave: () => void;
  saving: boolean;
  toast: { type: 'success' | 'error'; message: string } | null;
}

/**
 * Renders a save button with an inline toast notification.
 * Shows loading state while saving and displays success/error feedback.
 */
export default function SaveBar({ onSave, saving, toast }: SaveBarProps) {
  return (
    <div className={styles.bar}>
      {toast && (
        <span className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </span>
      )}
      <button
        className={styles.saveButton}
        onClick={onSave}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
