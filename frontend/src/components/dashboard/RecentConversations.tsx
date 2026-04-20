'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './RecentConversations.module.css';

/** Shape of a conversation as returned by GET /conversations. */
export interface RecentConversation {
  _id: string;
  phase: string;
  lastMessageAt: string | null;
  createdAt?: string;
  clinicId: { _id: string; name: string } | null;
  leadId: { _id: string; firstName: string; lastName: string; phone?: string } | null;
}

interface RecentConversationsProps {
  /** Conversations to display — caller is responsible for slicing to the desired count. */
  conversations: RecentConversation[];
  /** Optional "View all" link override. Defaults to /conversations. */
  viewAllHref?: string;
  /** Hide the clinic column (used on the clinic overview tab where context is implicit). */
  hideClinic?: boolean;
  /** Override the section heading. Defaults to "Recent Conversations". */
  title?: string;
  /** Hide the "View all" link entirely. */
  hideViewAll?: boolean;
}

/** Maps phase to the badge colour scheme used in the design. */
const PHASE_STYLES: Record<string, string> = {
  qualified: styles.badgeQualified,
  booking: styles.badgeBooking,
  booked: styles.badgeConfirmed,
  confirmed: styles.badgeConfirmed,
  declined: styles.badgeDeclined,
  cancelled: styles.badgeDeclined,
  escalated: styles.badgeDeclined,
  stalled: styles.badgeDeclined,
};

/** Capitalises the first letter of a phase label. */
function formatPhase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/** Formats "X days ago" / "X hours ago" for the right-hand column. */
function formatRelative(timestamp: string | null): string {
  if (!timestamp) return 'No messages yet';
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  return `${days} days ago`;
}

/**
 * Recent Conversations panel used on both the main dashboard and the
 * individual clinic overview tab. Rows are not interactive on the
 * dashboard per the current design — clicking "View all" opens the full
 * conversations list instead.
 */
export default function RecentConversations({ conversations, viewAllHref = '/conversations', hideClinic = false, title = 'Recent Conversations', hideViewAll = false }: RecentConversationsProps) {
  const router = useRouter();

  return (
    <section className={styles.card} aria-labelledby="recent-conversations-heading">
      <div className={styles.header}>
        <h2 id="recent-conversations-heading" className={styles.heading}>{title}</h2>
        {!hideViewAll && <Link href={viewAllHref} className={styles.viewAll}>View all</Link>}
      </div>

      {conversations.length === 0 ? (
        <p className={styles.empty}>No recent conversations.</p>
      ) : (
        <ul className={styles.list}>
          {conversations.map((c) => {
            const name = c.leadId
              ? [c.leadId.firstName, c.leadId.lastName].filter(Boolean).join(' ') || 'Unknown'
              : 'Unknown';
            const clinic = c.clinicId?.name ?? 'Unknown clinic';
            const badgeClass = PHASE_STYLES[c.phase] ?? styles.badgeQualified;
            const when = formatRelative(c.lastMessageAt ?? c.createdAt ?? null);
            return (
              <li
                key={c._id}
                className={styles.row}
                onClick={() => router.push(`/conversations/${c._id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') router.push(`/conversations/${c._id}`);
                }}
                role="link"
                tabIndex={0}
                aria-label={`Open conversation with ${name}`}
              >
                <div className={styles.personCol}>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.subtle}>
                    {hideClinic ? (c.leadId?.phone || 'No phone') : clinic}
                  </span>
                </div>
                <span className={`${styles.badge} ${badgeClass}`}>{formatPhase(c.phase)}</span>
                <span className={styles.when}>{when}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
