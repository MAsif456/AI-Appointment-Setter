'use client';

import { useState, useEffect, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiAxios';
import {
  HighPriorityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BookingPhaseIcon,
  ConfirmedPhaseIcon,
  QualifiedPhaseIcon,
  DeclinedPhaseIcon,
} from '@/components/Icons';
import styles from './ConversationList.module.css';

const ITEMS_PER_PAGE = 10;

/** Maps each phase to its distinct icon component */
const PHASE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  booking: BookingPhaseIcon,
  booked: ConfirmedPhaseIcon,
  confirmed: ConfirmedPhaseIcon,
  qualified: QualifiedPhaseIcon,
  declined: DeclinedPhaseIcon,
  cancelled: DeclinedPhaseIcon,
  escalated: DeclinedPhaseIcon,
  stalled: DeclinedPhaseIcon,
};

/** Maps each phase to its coloured icon CSS class */
const PHASE_ICON_COLOURS: Record<string, string> = {
  booking: styles.phaseIconBooking,
  booked: styles.phaseIconConfirmed,
  confirmed: styles.phaseIconConfirmed,
  qualified: styles.phaseIconQualified,
  declined: styles.phaseIconDeclined,
  cancelled: styles.phaseIconDeclined,
  escalated: styles.phaseIconEscalated,
  stalled: styles.phaseIconDefault,
};

interface Conversation {
  _id: string;
  phase: string;
  isHighPriority: boolean;
  lastMessageAt: string | null;
  clinicId: { _id: string; name: string } | null;
  leadId: { _id: string; firstName: string; lastName: string; phone: string } | null;
  channel: string;
}

/**
 * Displays the list of all conversations with search, filters,
 * priority indicators, pagination, and a data table.
 * Fetches real data from the backend API.
 */
export default function ConversationList() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clinicFilter, setClinicFilter] = useState('All Clinics');
  // Lead status is modelled as `phase` on the backend — this filter
  // is labelled "Lead Status" in the UI to match the acceptance
  // criteria, but the underlying state is still the phase string.
  const [phaseFilter, setPhaseFilter] = useState('All Statuses');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'active' | 'redacted'>('active');

  // Fetch conversations from API — re-fetches when tab changes
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const params = activeTab === 'redacted' ? '?redacted=true' : '';
        const response = await api.get(`/conversations${params}`);
        setConversations(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch conversations:', err);
        setError(err.response?.data?.message || 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [activeTab]);

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Conversations</h1>
        <p>Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Conversations</h1>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }

  const priorityCount = conversations.filter((c) => c.isHighPriority).length;

  const filtered = conversations.filter((c) => {
    const patientName = c.leadId
    ? [c.leadId.firstName, c.leadId.lastName].filter(Boolean).join(' ') || 'Unknown'
    : 'Unknown';
    const phone = c.leadId?.phone || '';
    const clinic = c.clinicId?.name || 'Unknown Clinic';

    const matchesSearch =
      patientName.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search);
    const matchesClinic =
      clinicFilter === 'All Clinics' || clinic === clinicFilter;
    const matchesPhase =
      phaseFilter === 'All Statuses' || c.phase === phaseFilter;
    return matchesSearch && matchesClinic && matchesPhase;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
  const paged = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Extract unique clinic names for filter dropdown
  const clinics = [
    'All Clinics',
    ...new Set(conversations.map((c) => c.clinicId?.name || 'Unknown Clinic')),
  ];

  // Extract unique lead statuses (phases) for filter dropdown
  const phases = [
    'All Statuses',
    ...new Set(conversations.map((c) => c.phase)),
  ];

  const handleRowClick = (conv: Conversation) => {
    router.push(`/conversations/${conv._id}`); // ← Uses real MongoDB ID
  };

  // Format phase for display (capitalize first letter)
  const formatPhase = (phase: string) =>
    phase.charAt(0).toUpperCase() + phase.slice(1);

  // Format last message time
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'No messages yet';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Conversations</h1>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'active' ? styles.tabActive : styles.tab}
          onClick={() => { setActiveTab('active'); setPage(1); }}
        >
          Active
        </button>
        <button
          className={activeTab === 'redacted' ? styles.tabActive : styles.tab}
          onClick={() => { setActiveTab('redacted'); setPage(1); }}
        >
          Redacted
        </button>
      </div>

      {priorityCount > 0 && activeTab === 'active' && (
        <div className={styles.priorityBanner}>
          <HighPriorityIcon className={styles.priorityBannerIcon} />
          <span>
            <strong>{priorityCount} high priority</strong> urgent cases shown first
          </span>
        </div>
      )}

      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={styles.filterSelect}
          value={clinicFilter}
          aria-label="Filter by clinic"
          onChange={(e) => {
            setClinicFilter(e.target.value);
            setPage(1);
          }}
        >
          {clinics.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={phaseFilter}
          aria-label="Filter by lead status"
          onChange={(e) => {
            setPhaseFilter(e.target.value);
            setPage(1);
          }}
        >
          {phases.map((p) => (
            <option key={p} value={p}>
              {formatPhase(p)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <p style={{ padding: '2rem', textAlign: 'center' }}>
          No conversations found matching your filters.
        </p>
      )}

      {filtered.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Phone</th>
                <th>Clinic</th>
                <th>Lead Source</th>
                <th>Phase</th>
                <th>Last Message</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((conv) => {
                const patientName = conv.leadId
                ? [conv.leadId.firstName, conv.leadId.lastName].filter(Boolean).join(' ') || 'Unknown'
                  : 'Unknown';
                const phone = conv.leadId?.phone || 'N/A';
                const clinic = conv.clinicId?.name || 'Unknown Clinic';
                const PhaseIcon = PHASE_ICONS[conv.phase] ?? BookingPhaseIcon;

                return (
                  <tr key={conv._id} onClick={() => handleRowClick(conv)}>
                    <td>
                      <div className={styles.nameCell}>
                        {patientName}
                        {conv.isHighPriority && (
                          <HighPriorityIcon className={styles.priorityIcon} />
                        )}
                      </div>
                    </td>
                    <td>{phone}</td>
                    <td>{clinic}</td>
                    <td>{conv.channel}</td>
                    <td>
                      <span className={styles.phaseBadge}>
                        <PhaseIcon className={`${styles.phaseIcon} ${PHASE_ICON_COLOURS[conv.phase] ?? styles.phaseIconDefault}`} />
                        {formatPhase(conv.phase)}
                      </span>
                    </td>
                    <td className={styles.lastMessage}>
                      {formatTime(conv.lastMessageAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className={styles.pagination}>
            <span className={styles.pageInfo}>
              {`${startIdx + 1}–${Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className={styles.pageControls}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeftIcon className={styles.pageBtnIcon} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={n === safePage ? styles.pageBtnActive : styles.pageBtn}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRightIcon className={styles.pageBtnIcon} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}