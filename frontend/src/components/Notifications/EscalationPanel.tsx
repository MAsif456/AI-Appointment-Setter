'use client';

/**
 * Slide-out drawer that lists all unresolved escalations for the
 * current staff member. Opened from the bell icon in the sidebar.
 *
 * Deliberately stateless beyond open/closed — all data comes from
 * the escalation context, so the bell badge and the panel list
 * stay in lock-step.
 */

import { useEscalationNotifications } from '@/contexts/EscalationNotificationContext';
import EscalationCard from './EscalationCard';
import styles from './Notifications.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function EscalationPanel({ open, onClose }: Props) {
  const { items, acknowledge, resolve } = useEscalationNotifications();

  if (!open) return null;

  // Sort newest first so the freshest escalation is always top.
  const sorted = [...items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <>
      <div
        className={styles.panelOverlay}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={styles.panel}
        role="dialog"
        aria-label="Escalation notifications"
      >
        <header className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Escalations</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close escalations panel"
          >
            ×
          </button>
        </header>

        <div className={styles.panelBody}>
          {sorted.length === 0 ? (
            <div className={styles.emptyState}>
              No active escalations. Any time the AI gets stuck, an
              emergency is detected, or a lead is flagged for abuse,
              it&apos;ll show up here in real time.
            </div>
          ) : (
            sorted.map((item) => (
              <EscalationCard
                key={item.id}
                item={item}
                onAcknowledge={acknowledge}
                onResolve={resolve}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
