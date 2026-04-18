'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  type InboxNotification,
} from '@/lib/api/notifications';
import styles from './page.module.css';

const DUMMY_PAGE_SIZE = 10;

const ALL_DUMMY: InboxNotification[] = [
  { _id: 'd-01', type: 'email_notification',     title: 'New enquiry received',        description: 'Sarah Johnson has sent a new enquiry',                                   isRead: false, relatedEntityId: 'conv-001', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
  { _id: 'd-02', type: 'escalated_conversation', title: 'Conversation escalated',      description: 'Emily Clarke needs urgent attention — 3 unanswered messages',            isRead: false, relatedEntityId: 'conv-003', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
  { _id: 'd-03', type: 'stalled_conversation',   title: 'Lead not responding',         description: 'Michael Brown has not responded in 24 hours',                            isRead: false, relatedEntityId: 'conv-002', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
  { _id: 'd-04', type: 'email_notification',     title: 'New enquiry received',        description: 'Priya Sharma has sent a new enquiry about physiotherapy',                isRead: false, relatedEntityId: 'conv-004', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
  { _id: 'd-05', type: 'booking_cancelled',      title: 'Booking cancelled',           description: 'A patient cancelled their appointment on Thursday 24 Apr at 10:30 AM',   isRead: false, relatedEntityId: 'appt-001', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString() },
  { _id: 'd-06', type: 'email_notification',     title: 'New enquiry received',        description: 'David Okafor enquired about back pain treatment',                        isRead: false, relatedEntityId: 'conv-005', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 70 * 60 * 1000).toISOString() },
  { _id: 'd-07', type: 'appointment_reminder',   title: 'Appointment reminder sent',   description: 'Reminder sent for appointment on Mon 21 Apr at 9:00 AM',                 isRead: false, relatedEntityId: 'appt-002', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
  { _id: 'd-08', type: 'escalated_conversation', title: 'Conversation escalated',      description: 'Thomas Wright sent abusive messages — flagged for review',               isRead: false, relatedEntityId: 'conv-006', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-09', type: 'new_user_joined',        title: 'New user joined',             description: 'James Patel joined as staff',                                            isRead: false, relatedEntityType: 'user',                                      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-10', type: 'stalled_conversation',   title: 'Lead not responding',         description: 'Fatima Al-Hassan has not responded in 24 hours',                         isRead: false, relatedEntityId: 'conv-007', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-11', type: 'email_notification',     title: 'New enquiry received',        description: 'Lucas Martins enquired about sports injury rehab',                       isRead: true,  relatedEntityId: 'conv-008', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-12', type: 'booking_cancelled',      title: 'Booking cancelled',           description: 'A patient cancelled their appointment on Friday 25 Apr at 2:00 PM',      isRead: true,  relatedEntityId: 'appt-003', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-13', type: 'appointment_reminder',   title: 'Appointment reminder sent',   description: 'Reminder sent for appointment on Tue 22 Apr at 11:00 AM',                isRead: true,  relatedEntityId: 'appt-004', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-14', type: 'escalated_conversation', title: 'Conversation escalated',      description: 'Aisha Nwosu — AI failed to understand 3 consecutive messages',           isRead: true,  relatedEntityId: 'conv-009', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-15', type: 'email_notification',     title: 'New enquiry received',        description: 'Connor Hughes has sent a new enquiry about knee pain',                   isRead: true,  relatedEntityId: 'conv-010', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-16', type: 'new_user_joined',        title: 'New user joined',             description: 'Amara Diallo joined as staff',                                           isRead: true,  relatedEntityType: 'user',                                      createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-17', type: 'stalled_conversation',   title: 'Lead not responding',         description: 'Ryan Chadwick has not responded in 24 hours',                            isRead: true,  relatedEntityId: 'conv-011', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-18', type: 'booking_cancelled',      title: 'Booking cancelled',           description: 'A patient cancelled their appointment on Wed 23 Apr at 3:30 PM',         isRead: true,  relatedEntityId: 'appt-005', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-19', type: 'appointment_reminder',   title: 'Appointment reminder sent',   description: 'Reminder sent for appointment on Thu 24 Apr at 8:30 AM',                 isRead: true,  relatedEntityId: 'appt-006', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-20', type: 'email_notification',     title: 'New enquiry received',        description: 'Zara Ahmed has sent a new enquiry about posture correction',             isRead: true,  relatedEntityId: 'conv-012', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-21', type: 'escalated_conversation', title: 'Conversation escalated',      description: 'Noah Kamara is requesting immediate callback — urgency detected',        isRead: true,  relatedEntityId: 'conv-013', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 1.2 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-22', type: 'stalled_conversation',   title: 'Lead not responding',         description: 'Grace Osei has not responded in 24 hours',                               isRead: true,  relatedEntityId: 'conv-014', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-23', type: 'new_user_joined',        title: 'New user joined',             description: 'Sofia Reyes joined as admin',                                            isRead: true,  relatedEntityType: 'user',                                      createdAt: new Date(Date.now() - 1.8 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-24', type: 'booking_cancelled',      title: 'Booking cancelled',           description: 'A patient cancelled their appointment on Mon 21 Apr at 9:00 AM',         isRead: true,  relatedEntityId: 'appt-007', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-25', type: 'appointment_reminder',   title: 'Appointment reminder sent',   description: 'Reminder sent for appointment on Fri 25 Apr at 1:00 PM',                 isRead: true,  relatedEntityId: 'appt-008', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 2.2 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-26', type: 'email_notification',     title: 'New enquiry received',        description: 'Ethan Brooks has sent a new enquiry about ankle rehab',                  isRead: true,  relatedEntityId: 'conv-015', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-27', type: 'stalled_conversation',   title: 'Lead not responding',         description: 'Isabelle Fontaine has not responded in 24 hours',                        isRead: true,  relatedEntityId: 'conv-016', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-28', type: 'escalated_conversation', title: 'Conversation escalated',      description: 'Marcus Reid — patient reported chest pain, flagged as emergency',        isRead: true,  relatedEntityId: 'conv-017', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 3.2 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-29', type: 'appointment_reminder',   title: 'Appointment reminder sent',   description: 'Reminder sent for appointment on Sat 26 Apr at 10:00 AM',                isRead: true,  relatedEntityId: 'appt-009', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-30', type: 'booking_cancelled',      title: 'Booking cancelled',           description: 'A patient cancelled their appointment on Tue 22 Apr at 4:00 PM',         isRead: true,  relatedEntityId: 'appt-010', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-31', type: 'new_user_joined',        title: 'New user joined',             description: 'Daniel Okonkwo joined as staff',                                         isRead: true,  relatedEntityType: 'user',                                      createdAt: new Date(Date.now() - 4.3 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-32', type: 'email_notification',     title: 'New enquiry received',        description: 'Chloe Bennett has sent a new enquiry about neck pain',                   isRead: true,  relatedEntityId: 'conv-018', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 4.5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-33', type: 'stalled_conversation',   title: 'Lead not responding',         description: 'Omar Khalil has not responded in 24 hours',                              isRead: true,  relatedEntityId: 'conv-019', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-34', type: 'appointment_reminder',   title: 'Appointment reminder sent',   description: 'Reminder sent for appointment on Sun 27 Apr at 11:30 AM',                isRead: true,  relatedEntityId: 'appt-011', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 5.2 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-35', type: 'escalated_conversation', title: 'Conversation escalated',      description: 'Lily Chen — repeated booking failures, manual intervention needed',      isRead: true,  relatedEntityId: 'conv-020', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 5.5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-36', type: 'booking_cancelled',      title: 'Booking cancelled',           description: 'A patient cancelled their appointment on Wed 23 Apr at 8:00 AM',         isRead: true,  relatedEntityId: 'appt-012', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-37', type: 'email_notification',     title: 'New enquiry received',        description: 'Aaron Mensah enquired about post-surgery rehabilitation',                 isRead: true,  relatedEntityId: 'conv-021', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 6.3 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-38', type: 'new_user_joined',        title: 'New user joined',             description: 'Hannah Wren joined as staff',                                            isRead: true,  relatedEntityType: 'user',                                      createdAt: new Date(Date.now() - 6.5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-39', type: 'stalled_conversation',   title: 'Lead not responding',         description: 'Victor Santos has not responded in 24 hours',                            isRead: true,  relatedEntityId: 'conv-022', relatedEntityType: 'conversation', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'd-40', type: 'appointment_reminder',   title: 'Appointment reminder sent',   description: 'Reminder sent for appointment on Mon 28 Apr at 2:30 PM',                 isRead: true,  relatedEntityId: 'appt-013', relatedEntityType: 'appointment', createdAt: new Date(Date.now() - 7.5 * 24 * 60 * 60 * 1000).toISOString() },
];

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
  email_notification:     'New enquiry',
  stalled_conversation:   'Stalled conversation',
  escalated_conversation: 'Escalated conversation',
  booking_cancelled:      'Booking cancelled',
  new_user_joined:        'New user joined',
  appointment_reminder:   'Appointment reminder',
};

export default function NotificationsPage() {
  const router = useRouter();
  const [allNotifications, setAllNotifications] = useState<InboxNotification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all');
  const [sortOrder, setSortOrder]       = useState<SortOrder>('newest');

  const load = useCallback(async (p: number) => {
    // DUMMY DATA — remove and restore the real fetch below when done previewing
    const start = (p - 1) * DUMMY_PAGE_SIZE;
    const slice = ALL_DUMMY.slice(start, start + DUMMY_PAGE_SIZE);
    const pages = Math.ceil(ALL_DUMMY.length / DUMMY_PAGE_SIZE);
    setAllNotifications(slice);
    setTotalPages(pages);
    // Real fetch:
    // try {
    //   const data = await fetchNotifications(p);
    //   setAllNotifications(data.notifications);
    //   setTotalPages(data.totalPages);
    // } catch {
    //   // silently fail — empty state is shown
    // }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(1).finally(() => setLoading(false));
  }, [load]);

  // Derive visible notifications from filter + sort applied to the current page slice
  const notifications = [...allNotifications]
    .filter((n) => statusFilter === 'all' ? true : statusFilter === 'unread' ? !n.isRead : n.isRead)
    .filter((n) => typeFilter === 'all' || n.type === typeFilter)
    .sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });

  const goToPage = (p: number) => {
    setPage(p);
    load(p);
  };

  const handleClick = async (n: InboxNotification) => {
    if (!n.isRead) {
      await markNotificationRead(n._id);
      setAllNotifications((prev) =>
        prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)),
      );
    }
    if (n.relatedEntityType === 'conversation' && n.relatedEntityId) {
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

  const hasUnread = allNotifications.some((n) => !n.isRead);

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
              {s === 'unread' && allNotifications.filter(n => !n.isRead).length > 0 && (
                <span className={styles.tabBadge}>{allNotifications.filter(n => !n.isRead).length}</span>
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
              {(Object.entries(TYPE_LABELS) as [InboxNotification['type'], string][]).map(([value, label]) => (
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
          <div className={styles.emptyIcon}>🔔</div>
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
                {!n.isRead && <span className={styles.unreadDot} />}
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