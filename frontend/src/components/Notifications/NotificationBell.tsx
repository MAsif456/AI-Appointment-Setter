'use client';

/**
 * Sidebar bell icon that opens the escalation panel and shows a
 * live count of unacknowledged escalations for the current staff
 * member. Renders nothing for admins — the provider isn't mounted
 * for them, so `useEscalationNotifications` would throw if called.
 *
 * The wrapper component below handles that role check so this
 * component can assume it's only ever rendered inside the provider.
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEscalationNotifications } from '@/contexts/EscalationNotificationContext';
import EscalationPanel from './EscalationPanel';
import styles from './Notifications.module.css';

function BellInner() {
  const [open, setOpen] = useState(false);
  const { unacknowledgedCount } = useEscalationNotifications();

  return (
    <>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setOpen(true)}
        aria-label={`Open escalations (${unacknowledgedCount} unacknowledged)`}
        data-testid="notification-bell"
      >
        {/* Simple inline bell glyph — avoids pulling an icon library */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unacknowledgedCount > 0 && (
          <span
            className={styles.bellBadge}
            data-testid="notification-bell-badge"
          >
            {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
          </span>
        )}
      </button>

      <EscalationPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Public wrapper. Returns null for admins / signed-out users so it
 * can be dropped into any layout unconditionally without the
 * parent having to care about role.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  if (user?.role !== 'staff') return null;
  return <BellInner />;
}
