'use client';

/**
 * Persistent queue page showing every unresolved escalation across
 * the staff member's assigned clinics.
 *
 * The bell + panel is the fast path for in-session staff; this
 * page is the reload-proof fallback. It reads from the same
 * context as the bell so the two views never disagree.
 */

import { useAuth } from '@/contexts/AuthContext';
import { useEscalationNotifications } from '@/contexts/EscalationNotificationContext';
import EscalationCard from '@/components/Notifications/EscalationCard';

export default function EscalationsPage() {
  const { user } = useAuth();
  const { items, acknowledge, resolve } = useEscalationNotifications();

  // Admins are not part of the escalation workflow — show an
  // explanation so the empty list is not mistaken for a bug.
  const isAdmin = user?.role === 'admin';

  // Newest first so the freshest escalation is always on top.
  const sorted = [...items]
    .filter((e) => !e.resolvedAt)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 4 }}>Escalations</h1>
      <p style={{ color: '#6b7280', marginTop: 0, marginBottom: 24 }}>
        Leads the AI couldn&apos;t handle. Call each person on this
        list as soon as you can.
      </p>

      {isAdmin ? (
        <div
          style={{
            padding: '48px 16px',
            textAlign: 'center',
            color: '#6b7280',
            border: '1px dashed #d1d5db',
            borderRadius: 8,
          }}
        >
          Escalations are handled by staff members assigned to each
          clinic. Sign in with a staff account to view and action
          escalations.
        </div>
      ) : sorted.length === 0 ? (
        <div
          style={{
            padding: '48px 16px',
            textAlign: 'center',
            color: '#6b7280',
            border: '1px dashed #d1d5db',
            borderRadius: 8,
          }}
        >
          No active escalations right now.
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
  );
}
