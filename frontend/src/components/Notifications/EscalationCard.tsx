'use client';

/**
 * Single escalation tile rendered inside the bell panel and the
 * persistent `/escalations` queue page.
 *
 * Shows the trigger type, reason, patient name and phone, with
 * "View chat" as the primary action and acknowledge/resolve
 * controls on the right.
 */

import Link from 'next/link';
import type { EscalationNotification, EscalationTrigger } from '@/types/escalation';
import styles from './Notifications.module.css';

interface Props {
  item: EscalationNotification;
  onAcknowledge: (id: string) => void;
  onResolve?: (id: string) => void;
}

const TRIGGER_LABELS: Record<EscalationTrigger, string> = {
  failed_understanding: 'AI STUCK',
  emergency: 'EMERGENCY',
  abuse: 'ABUSE FLAG',
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function EscalationCard({ item, onAcknowledge, onResolve }: Props) {
  const hasPhone = item.leadPhone && item.leadPhone.trim().length > 0;
  const cardClass = item.acknowledgedByMe
    ? `${styles.card} ${styles.cardDim}`
    : styles.card;

  return (
    <div className={cardClass} data-testid="escalation-card">
      <div className={styles.cardBody}>
        <div className={styles.cardLeft}>
          <div className={styles.cardTriggerRow}>
            <span className={styles.triggerBadge}>
              {TRIGGER_LABELS[item.trigger]}
            </span>
            <span className={styles.timestamp} title={item.createdAt}>
              {relativeTime(item.createdAt)}
            </span>
          </div>

          <div className={styles.cardName}>{item.leadName}</div>
          {hasPhone && (
            <div className={styles.cardPhone}>
              <a href={`tel:${item.leadPhone}`}>{item.leadPhone}</a>
            </div>
          )}
          <div className={styles.cardReason}>
            {item.reason} — {item.clinicName}
          </div>

          <Link
            className={styles.viewChatBtn}
            href={`/conversations/${item.conversationId}/escalated`}
          >
            View chat
          </Link>
        </div>

        <div className={styles.cardRight}>
          {!item.acknowledgedByMe && (
            <button
              type="button"
              className={styles.ackBtn}
              onClick={() => onAcknowledge(item.id)}
            >
              Acknowledge
            </button>
          )}
          {item.acknowledgedByMe && (
            <span className={styles.ackDone}>Acknowledged</span>
          )}
          {onResolve && (
            <button
              type="button"
              className={styles.resolveBtn}
              onClick={() => onResolve(item.id)}
            >
              Mark resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
