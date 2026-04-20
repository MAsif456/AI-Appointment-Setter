import { HighPriorityIcon, BookingPhaseIcon } from '@/components/Icons';
import {
  type Conversation,
  PHASE_ICONS,
  formatPhase,
  formatTime,
  getPatientName,
} from './conversationHelpers';
import styles from './ConversationList.module.css';

/** Phase-to-colour CSS class mapping for icons. */
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

interface ConversationTableProps {
  conversations: Conversation[];
  onRowClick: (conv: Conversation) => void;
}

/**
 * Renders the conversation data table with patient name,
 * phone, clinic, lead source, phase badge, and last message time.
 */
export default function ConversationTable({ conversations, onRowClick }: ConversationTableProps) {
  return (
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
        {conversations.map((conv) => {
          const patientName = getPatientName(conv);
          const phone = conv.leadId?.phone || 'N/A';
          const clinic = conv.clinicId?.name || 'Unknown Clinic';
          const PhaseIcon = PHASE_ICONS[conv.phase] ?? BookingPhaseIcon;

          return (
            <tr key={conv._id} onClick={() => onRowClick(conv)}>
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
  );
}
