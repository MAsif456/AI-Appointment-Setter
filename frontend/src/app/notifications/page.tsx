'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  type InboxNotification,
} from '@/lib/api/notifications';
import styles from './page.module.css';

const ADMIN_ONLY_TYPES: InboxNotification['type'][] = ['new_user_joined', 'gdpr_data_deletion'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function NotifIcon({ type }: { type: InboxNotification['type'] }) {
  if (type === 'email_notification') {
    return (
      <span className={`${styles.iconWrap} ${styles.iconEmail}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </span>
    );
  }
  if (type === 'stalled_conversation') {
    return (
      <span className={`${styles.iconWrap} ${styles.iconStalled}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
    );
  }
  if (type === 'escalated_conversation') {
    return (
      <span className={`${styles.iconWrap} ${styles.iconEscalated}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
    );
  }
  if (type === 'booking_cancelled') {
    return (
      <span className={`${styles.iconWrap} ${styles.iconCancelled}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="9" y1="14" x2="15" y2="20" />
          <line x1="15" y1="14" x2="9" y2="20" />
        </svg>
      </span>
    );
  }
  if (type === 'new_user_joined') {
    return (
      <span className={`${styles.iconWrap} ${styles.iconUser}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </span>
    );
  }
  if (type === 'gdpr_data_deletion') {
    return (
      <span className={`${styles.iconWrap} ${styles.iconGdpr}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </span>
    );
  }
  if (type === 'new_lead') {
    return (
      <span className={`${styles.iconWrap} ${styles.iconUser}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
    );
  }
  if (type === 'appointment_rescheduled') {
    return (
      <span className={`${styles.iconWrap} ${styles.iconAppt}`}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <polyline points="17 14 15 16 13 14" />
          <line x1="15" y1="16" x2="15" y2="12" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`${styles.iconWrap} ${styles.iconAppt}`}>
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </span>
  );
}

type StatusFilter = 'all' | 'unread' | 'read';
type TypeFilter = 'all' | InboxNotification['type'];
type SortOrder = 'newest' | 'oldest';

const TYPE_LABELS: Record<InboxNotification['type'], string> = {
  email_notification:       'New enquiry',
  stalled_conversation:     'Stalled conversation',
  escalated_conversation:   'Escalated conversation',
  booking_cancelled:        'Booking cancelled',
  new_user_joined:          'New staff member account created',
  appointment_reminder:     'Appointment reminder',
  gdpr_data_deletion:       'Data deletion request',
  new_lead:                 'New lead',
  appointment_rescheduled:  'Appointment rescheduled',
};

const ADMIN_ONLY_FILTER_TYPES: InboxNotification['type'][] = ['new_user_joined', 'gdpr_data_deletion'];

export default function NotificationsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [allNotifications, setAllNotifications] = useState<InboxNotification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all');
  const [sortOrder, setSortOrder]       = useState<SortOrder>('newest');

  const load = useCallback(async (p: number) => {
    try {
      const data = await fetchNotifications(p);
      setAllNotifications(data.notifications);
      setTotalPages(data.totalPages);
    } catch {
      // silently fail — empty state is shown
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(1).finally(() => setLoading(false));
  }, [load]);

  // Filter out admin-only notification types for non-admin users
  const visibleNotifications = allNotifications.filter(
    (n) => isAdmin || !ADMIN_ONLY_TYPES.includes(n.type),
  );

  const notifications = [...visibleNotifications]
    .filter((n) => statusFilter === 'all' ? true : statusFilter === 'unread' ? !n.isRead : n.isRead)
    .filter((n) => typeFilter === 'all' || n.type === typeFilter)
    .sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });

  const goToPage = (p: number) => {
    setPage(p);
    setLoadingMore(true);
    load(p).finally(() => setLoadingMore(false));
  };

  const handleClick = async (n: InboxNotification) => {
    if (!n.isRead) {
      await markNotificationRead(n._id);
      setAllNotifications((prev) =>
        prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)),
      );
    }
    if (n.type === 'gdpr_data_deletion') {
      router.push('/data-protection');
    } else if (n.type === 'escalated_conversation') {
      router.push('/escalations');
    } else if (n.relatedEntityType === 'conversation' && n.relatedEntityId) {
      router.push(`/conversations/${n.relatedEntityId}`);
    } else if (n.relatedEntityType === 'appointment' && n.relatedEntityId) {
      router.push(`/clinics/${n.relatedEntityId}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setAllNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
  };

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await dismissNotification(id);
    setAllNotifications((prev) => prev.filter((x) => x._id !== id));
  };

  const hasUnread = visibleNotifications.some((n) => !n.isRead);

  // Type filter options — admins see only their types; staff see everything except admin-only types
  const typeFilterOptions = (Object.entries(TYPE_LABELS) as [InboxNotification['type'], string][])
    .filter(([value]) => isAdmin ? ADMIN_ONLY_FILTER_TYPES.includes(value) : !ADMIN_ONLY_TYPES.includes(value));

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Notification Inbox</h1>
        {hasUnread && (
          <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Status tabs */}
        <div className={styles.statusTabs}>
          {(['all', 'unread', 'read'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              className={`${styles.statusTab} ${statusFilter === s ? styles.statusTabActive : ''}`}
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s === 'all' ? 'All' : s === 'unread' ? 'Unread' : 'Read'}
              {s === 'unread' && visibleNotifications.filter(n => !n.isRead).length > 0 && (
                <span className={styles.tabBadge}>{visibleNotifications.filter(n => !n.isRead).length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Type filter + sort */}
        <div className={styles.toolbarRight}>
          <div className={styles.selectWrap}>
            <svg className={styles.selectIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            <select
              className={styles.select}
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as TypeFilter); setPage(1); }}
            >
              <option value="all">All types</option>
              {typeFilterOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className={styles.selectWrap}>
            <svg className={styles.selectIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
            </svg>
            <select
              className={styles.select}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </>
      ) : notifications.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No notifications found</div>
          <div className={styles.emptyText}>Try adjusting your filters.</div>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {notifications.map((n) => (
              <div
                key={n._id}
                className={`${styles.item} ${!n.isRead ? styles.itemUnread : ''}`}
                onClick={() => handleClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleClick(n)}
              >
                <NotifIcon type={n.type} />
                <div className={styles.body}>
                  <div className={styles.notifTitle}>{n.title}</div>
                  <div className={styles.notifDesc}>{n.description}</div>
                  <div className={styles.notifTime}>{timeAgo(n.createdAt)}</div>
                </div>
                <button
                  className={styles.dismissBtn}
                  onClick={(e) => handleDismiss(e, n._id)}
                  aria-label="Dismiss notification"
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => goToPage(page - 1)}
                disabled={page === 1 || loadingMore}
              >
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  className={`${styles.pageBtn} ${num === page ? styles.pageBtnActive : ''}`}
                  onClick={() => goToPage(num)}
                  disabled={loadingMore}
                >
                  {num}
                </button>
              ))}
              <button
                className={styles.pageBtn}
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages || loadingMore}
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
