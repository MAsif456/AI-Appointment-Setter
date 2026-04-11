'use client';

/**
 * Persistent queue page showing every unresolved escalation across
 * the staff member's assigned clinics.
 *
 * The bell + panel is the fast path for in-session staff; this
 * page is the reload-proof fallback. It reads from the same
 * context as the bell so the two views never disagree.
 */

import { useEscalationNotifications } from '@/contexts/EscalationNotificationContext';
import EscalationCard from '@/components/Notifications/EscalationCard';

export default function EscalationsPage() {
  const { items, acknowledge } = useEscalationNotifications();

  // Newest first so the freshest escalation is always on top.
  const sorted = [...items]
    .filter((e) => !e.resolvedAt)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 4 }}>Escalations</h1>
      <p style={{ color: '#6b7280', marginTop: 0, marginBottom: 24 }}>
        Leads the AI couldn&apos;t handle. Call each person on this
        list as soon as you can.
      </p>

      {sorted.length === 0 ? (
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
          />
        ))
      )}
    </div>
  );
}
