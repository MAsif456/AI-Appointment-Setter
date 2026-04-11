'use client';

/**
 * Single escalation tile rendered inside the bell panel and the
 * persistent `/escalations` queue page.
 *
 * Shows the trigger type, reason, patient name, and — most
 * importantly — the phone number as a giant `tel:` link with
 * "Call ASAP" as the sole primary action. Staff are explicitly
 * not given any in-app reply affordance here.
 */

import Link from 'next/link';
import type { EscalationNotification, EscalationTrigger } from '@/types/escalation';
import styles from './Notifications.module.css';

interface Props {
  item: EscalationNotification;
  onAcknowledge: (id: string) => void;
}

// Human-readable labels for the trigger badge. Defined as a map
// so new triggers are a one-line change and typos are impossible.
const TRIGGER_LABELS: Record<EscalationTrigger, string> = {
  failed_understanding: 'AI STUCK',
  emergency: 'EMERGENCY',
  abuse: 'ABUSE FLAG',
};

/** Short relative-time label — full timestamp lives in the tooltip. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function EscalationCard({ item, onAcknowledge }: Props) {
  const hasPhone = item.leadPhone && item.leadPhone.trim().length > 0;
  const cardClass = item.acknowledgedByMe
    ? `${styles.card} ${styles.cardDim}`
    : styles.card;

  return (
    <div className={cardClass} data-testid="escalation-card">
      <div className={styles.cardTriggerRow}>
        <span className={styles.triggerBadge}>
          {TRIGGER_LABELS[item.trigger]}
        </span>
        <span className={styles.timestamp} title={item.createdAt}>
          {relativeTime(item.createdAt)}
        </span>
      </div>

      <div className={styles.cardName}>{item.leadName}</div>
      <div className={styles.cardReason}>
        {item.reason} — {item.clinicName}
      </div>

      {hasPhone ? (
        <div className={styles.phoneRow} aria-label="Lead phone number">
          {item.leadPhone}
        </div>
      ) : (
        <div className={styles.phoneMissing}>
          No phone on file — check GHL
        </div>
      )}

      <div className={styles.cardActions}>
        {hasPhone ? (
          <a
            className={styles.primaryCta}
            href={`tel:${item.leadPhone}`}
            onClick={() => onAcknowledge(item.id)}
          >
            Call ASAP
          </a>
        ) : (
          <span
            className={`${styles.primaryCta} ${styles.primaryCtaDisabled}`}
            aria-disabled="true"
          >
            Call ASAP
          </span>
        )}

        <Link
          className={styles.secondaryBtn}
          href={`/conversations/${item.conversationId}/escalated`}
        >
          View chat
        </Link>
      </div>
    </div>
  );
}
