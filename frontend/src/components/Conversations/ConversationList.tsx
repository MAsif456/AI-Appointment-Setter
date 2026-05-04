'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/apiAxios';
import { HighPriorityIcon } from '@/components/Icons';
import ConversationTable from './ConversationTable';
import ConversationPagination from './ConversationPagination';
import {
  type Conversation,
  KNOWN_PHASES,
  ITEMS_PER_PAGE,
  formatPhase,
  getPatientName,
} from './conversationHelpers';
import styles from './ConversationList.module.css';

/**
 * Displays the conversation list with search, filters,
 * priority indicators, pagination, and a data table.
 * Fetches live data from the backend API.
 */
export default function ConversationList() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clinicFilter, setClinicFilter] = useState('All Clinics');
  // Lead status is modelled as `phase` on the backend — the filter
  // is labelled "Lead Status" in the UI to match acceptance criteria.
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
        <p style={{ color: 'var(--color-error)' }}>{error}</p>
      </div>
    );
  }

  const priorityCount = conversations.filter((c) => c.isHighPriority).length;

  // Filter, then sort — urgent conversations appear first
  const filtered = conversations.filter((c) => {
    const patientName = getPatientName(c);
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
  }).sort((a, b) => {
    if (a.isHighPriority && !b.isHighPriority) return -1;
    if (!a.isHighPriority && b.isHighPriority) return 1;
    const ta = new Date(a.lastMessageAt ?? 0).getTime();
    const tb = new Date(b.lastMessageAt ?? 0).getTime();
    return tb - ta;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
  const paged = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Unique clinic names for filter dropdown
  const clinics = [
    'All Clinics',
    ...new Set(conversations.map((c) => c.clinicId?.name || 'Unknown Clinic')),
  ];

  // Phase filter — known phases always shown, plus any extras from data
  const phases = [
    'All Statuses',
    ...KNOWN_PHASES,
    ...new Set(conversations.map((c) => c.phase).filter((p) => !KNOWN_PHASES.includes(p))),
  ];

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
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className={styles.filterSelect}
          value={clinicFilter}
          aria-label="Filter by clinic"
          onChange={(e) => { setClinicFilter(e.target.value); setPage(1); }}
        >
          {clinics.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className={styles.filterSelect}
          value={phaseFilter}
          aria-label="Filter by lead status"
          onChange={(e) => { setPhaseFilter(e.target.value); setPage(1); }}
        >
          {phases.map((p) => <option key={p} value={p}>{formatPhase(p)}</option>)}
        </select>
      </div>

      {filtered.length === 0 && (
        <p style={{ padding: '2rem', textAlign: 'center' }}>
          No conversations found matching your filters.
        </p>
      )}

      {filtered.length > 0 && (
        <>
          <ConversationTable
            conversations={paged}
            onRowClick={(conv) => router.push(`/conversations/${conv._id}`)}
          />
          <ConversationPagination
            currentPage={safePage}
            totalPages={totalPages}
            startIdx={startIdx}
            endIdx={Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)}
            totalItems={filtered.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
