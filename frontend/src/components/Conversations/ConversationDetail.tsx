'use client';

import Link from 'next/link';
import { ConversationDetail as ConversationDetailType } from '@/data/mockConversations';
import styles from './ConversationDetail.module.css';

interface Props {
  conversation: ConversationDetailType;
}

/**
 * Displays a full conversation thread with message history,
 * patient info, conversation status, and booking details.
 */
export default function ConversationDetail({ conversation }: Props) {
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
