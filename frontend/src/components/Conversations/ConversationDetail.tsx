'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ConversationDetail as ConversationDetailType } from '@/data/mockConversations';
import api from '@/lib/apiAxios';
import styles from './ConversationDetail.module.css';

interface ConsentRecord {
  _id: string;
  status: 'granted' | 'declined' | 'withdrawn';
  consentStatementVersion: string;
  channel: string;
  createdAt: string;
}

interface Props {
  conversation: ConversationDetailType;
  leadId?: string;
}

/**
 * Displays a full conversation thread with message history,
 * patient info, conversation status, and booking details.
 */
export default function ConversationDetail({ conversation, leadId }: Props) {
  const statusMap: Record<string, string> = {
    Confirmed: styles.statusConfirmed,
    Qualified: styles.statusQualified,
    Declined: styles.statusDeclined,
  };
  const statusClass = statusMap[conversation.phase] ?? styles.statusBooking;

  return (
    <div className={styles.container}>
      <Link href="/conversations" className={styles.backLink}>
        &larr; Back to Conversations
      </Link>

      <h1 className={styles.title}>
        Conversation with {conversation.patientName}
      </h1>

      <div className={styles.layout}>
        {/* Message History */}
        <div className={styles.messagePanel}>
          <h2 className={styles.panelTitle}>Message History</h2>
          <div className={styles.messages}>
            {conversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.sender === 'ai'
                    ? styles.aiMessage
                    : styles.leadMessage
                }
              >
                {msg.content}
                <div className={styles.messageTime}>
                  {msg.timestamp}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className={styles.sidebar}>
          <PatientInfo conversation={conversation} />
          <ConversationStatus
            conversation={conversation}
            statusClass={statusClass}
          />
          {conversation.booking && (
            <BookingInfo
              booking={conversation.booking}
              statusClass={statusClass}
            />
          )}
          <ActionButtons />
          {leadId && <GdprSection leadId={leadId} />}
        </div>
      </div>
    </div>
  );
}

/** Displays patient contact details and inquiry info */
function PatientInfo({
  conversation,
}: {
  conversation: ConversationDetailType;
}) {
  return (
    <div className={styles.infoCard}>
      <h3 className={styles.cardTitle}>Patient Info</h3>
      <InfoRow label="Name" value={conversation.patientName} />
      <InfoRow label="Phone" value={conversation.phone} />
      <InfoRow label="Email" value={conversation.email} />
      <InfoRow label="Lead Source" value={conversation.leadSource} />
      <InfoRow label="Issue" value={conversation.issue} />
      <InfoRow label="Postcode" value={conversation.postcode} />
      <InfoRow label="Urgency" value={conversation.urgency} />
    </div>
  );
}

/** Displays the conversation phase, clinic, and timing info */
function ConversationStatus({
  conversation,
  statusClass,
}: {
  conversation: ConversationDetailType;
  statusClass: string;
}) {
  return (
    <div className={styles.infoCard}>
      <h3 className={styles.cardTitle}>Conversation Status</h3>
      <div className={styles.infoRow}>
        <div className={styles.infoLabel}>Phase</div>
        <span className={`${styles.statusBadge} ${statusClass}`}>
          {conversation.phase}
        </span>
      </div>
      <InfoRow label="Clinic" value={conversation.clinic} />
      <InfoRow label="Started" value={conversation.startedAt} />
      <InfoRow
        label="Last message"
        value={conversation.lastMessageAt}
      />
      <div className={styles.infoRow}>
        <div className={styles.infoLabel}>Total messages</div>
        <div className={styles.infoValue}>
          {conversation.messageCount}
        </div>
      </div>
    </div>
  );
}

/** Displays booking/appointment details when available */
function BookingInfo({
  booking,
  statusClass,
}: {
  booking: NonNullable<ConversationDetailType['booking']>;
  statusClass: string;
}) {
  return (
    <div className={styles.infoCard}>
      <h3 className={styles.cardTitle}>Booking Info</h3>
      <InfoRow label="Date" value={booking.date} />
      <InfoRow label="Time" value={booking.time} />
      <InfoRow label="Appointment ID" value={booking.appointmentId} />
      <div className={styles.infoRow}>
        <div className={styles.infoLabel}>Status</div>
        <span className={`${styles.statusBadge} ${statusClass}`}>
          {booking.status}
        </span>
      </div>
    </div>
  );
}

/** Action buttons for flagging and external links */
function ActionButtons() {
  return (
    <div className={styles.actions}>
      <button className={styles.actionBtn}>
        &#9873; Flag for Review
      </button>
      <button className={styles.actionBtn}>
        &#8599; View in GHL
      </button>
    </div>
  );
}

/** GDPR data subject rights — consent history and erasure (UK GDPR Art. 7, 17). */
function GdprSection({ leadId }: { leadId: string }) {
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [erasing, setErasing] = useState(false);
  const [erasureResult, setErasureResult] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchConsent = useCallback(async () => {
    try {
      const res = await api.get(`/gdpr/consent/${leadId}`);
      setConsentHistory(res.data);
    } catch {
      setConsentHistory([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchConsent(); }, [fetchConsent]);

  const handleErase = async () => {
    setConfirmOpen(false);
    setErasing(true);
    setErasureResult(null);
    try {
      await api.delete(`/gdpr/erasure/${leadId}`);
      setErasureResult('Patient data erased successfully.');
      fetchConsent();
    } catch (err: any) {
      setErasureResult(err.response?.data?.message || 'Erasure failed.');
    } finally {
      setErasing(false);
    }
  };

  const statusLabel: Record<string, string> = {
    granted: 'Granted',
    declined: 'Declined',
    withdrawn: 'Withdrawn',
  };

  return (
    <div className={styles.infoCard}>
      <h3 className={styles.cardTitle}>Data Protection</h3>

      {/* Consent history */}
      <div className={styles.gdprSubHeading}>Consent History</div>
      {loading ? (
        <p className={styles.gdprMuted}>Loading...</p>
      ) : consentHistory.length === 0 ? (
        <p className={styles.gdprMuted}>No consent records found.</p>
      ) : (
        <ul className={styles.consentList}>
          {consentHistory.map((record) => (
            <li key={record._id} className={styles.consentItem}>
              <span className={`${styles.consentBadge} ${
                record.status === 'granted'
                  ? styles.consentGranted
                  : record.status === 'declined'
                    ? styles.consentDeclined
                    : styles.consentWithdrawn
              }`}>
                {statusLabel[record.status] ?? record.status}
              </span>
              <span className={styles.consentDate}>
                {new Date(record.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Erasure */}
      {erasureResult && (
        <p role="status" className={styles.gdprResult}>{erasureResult}</p>
      )}

      {confirmOpen ? (
        <div className={styles.confirmBox}>
          <p className={styles.confirmText}>
            This will permanently anonymise all personal data for this patient. This action cannot be undone.
          </p>
          <div className={styles.confirmActions}>
            <button className={styles.confirmBtn} onClick={handleErase} disabled={erasing}>
              Confirm Delete
            </button>
            <button className={styles.cancelBtn} onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className={styles.eraseBtn}
          onClick={() => setConfirmOpen(true)}
          disabled={erasing}
        >
          {erasing ? 'Erasing...' : 'Delete Patient Data'}
        </button>
      )}
    </div>
  );
}

/** Reusable label/value row for info cards */
function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.infoRow}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  );
}
