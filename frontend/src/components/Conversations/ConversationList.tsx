'use client';

import { useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { mockConversations } from '@/data/mockConversations';
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
  Booking: BookingPhaseIcon,
  Confirmed: ConfirmedPhaseIcon,
  Qualified: QualifiedPhaseIcon,
  Declined: DeclinedPhaseIcon,
};

/**
 * Displays the list of all conversations with search, filters,
 * priority indicators, pagination, and a data table.
 * Booking-phase leads route to live AI chat; others to static detail.
 */
export default function ConversationList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [clinicFilter, setClinicFilter] = useState('All Clinics');
  const [phaseFilter, setPhaseFilter] = useState('All Phases');
  const [page, setPage] = useState(1);

  const priorityCount = mockConversations.filter(
    (c) => c.isHighPriority,
  ).length;

  const filtered = mockConversations.filter((c) => {
    const matchesSearch =
      c.patientName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchesClinic =
      clinicFilter === 'All Clinics' || c.clinic === clinicFilter;
    const matchesPhase =
      phaseFilter === 'All Phases' || c.phase === phaseFilter;
    return matchesSearch && matchesClinic && matchesPhase;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
  const paged = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const clinics = ['All Clinics', ...new Set(mockConversations.map((c) => c.clinic))];
  const phases = ['All Phases', ...new Set(mockConversations.map((c) => c.phase))];

  const handleRowClick = (conv: typeof mockConversations[0]) => {
    router.push(`/conversations/${conv.id}`);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Conversations</h1>

      {priorityCount > 0 && (
        <div className={styles.priorityBanner}>
          <HighPriorityIcon className={styles.priorityBannerIcon} />
          <span>
            <strong>{priorityCount} high priority</strong> — urgent cases shown first
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
          onChange={(e) => { setClinicFilter(e.target.value); setPage(1); }}
        >
          {clinics.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className={styles.filterSelect}
          value={phaseFilter}
          onChange={(e) => { setPhaseFilter(e.target.value); setPage(1); }}
        >
          {phases.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

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
            const PhaseIcon = PHASE_ICONS[conv.phase] ?? BookingPhaseIcon;
            return (
              <tr key={conv.id} onClick={() => handleRowClick(conv)}>
                <td>
                  <div className={styles.nameCell}>
                    {conv.patientName}
                    {conv.isHighPriority && (
                      <HighPriorityIcon className={styles.priorityIcon} />
                    )}
                  </div>
                </td>
                <td>{conv.phone}</td>
                <td>{conv.clinic}</td>
                <td>{conv.leadSource}</td>
                <td>
                  <span className={styles.phaseBadge}>
                    <PhaseIcon className={styles.phaseIcon} />
                    {conv.phase}
                  </span>
                </td>
                <td className={styles.lastMessage}>{conv.lastMessage}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          {filtered.length === 0
            ? 'No results'
            : `${startIdx + 1}–${Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} of ${filtered.length}`}
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
    </div>
  );
}
