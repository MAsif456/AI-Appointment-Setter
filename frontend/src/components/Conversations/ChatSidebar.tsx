import styles from './LiveChat.module.css';

/** Lead details shown in the sidebar */
export interface LeadDetails {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  issue?: string;
  postcode?: string;
  leadSource?: string;
}

/** Clinic details shown in the sidebar */
export interface ClinicDetails {
  name: string;
  tone?: string;
}

interface ChatSidebarProps {
  lead: LeadDetails | null;
  clinic: ClinicDetails | null;
  phase: string;
  messageCount: number;
}

/** Capitalises the first letter of each word */
function capitalise(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Phase display class mapping */
const PHASE_CLASSES: Record<string, string> = {
  greeting: styles.phaseGreeting,
  qualifying: styles.phaseQualifying,
  booking: styles.phaseBooking,
  confirmed: styles.phaseConfirmed,
};

/**
 * Sidebar showing patient info, clinic config, and conversation status
 * alongside the chat panel.
 */
export default function ChatSidebar({
  lead,
  clinic,
  phase,
  messageCount,
}: ChatSidebarProps) {
  const phaseClass = PHASE_CLASSES[phase] || styles.phaseGreeting;

  return (
    <div className={styles.sidebar}>
      {/* Patient Info */}
      <div className={styles.infoCard}>
        <h3 className={styles.cardTitle}>Patient Info</h3>
        {lead ? (
          <>
            <InfoRow label="Name" value={`${lead.firstName} ${lead.lastName ?? ''}`.trim()} />
            {lead.phone && <InfoRow label="Phone" value={lead.phone} />}
            {lead.email && <InfoRow label="Email" value={lead.email} />}
            {lead.issue && <InfoRow label="Issue" value={lead.issue} />}
            {lead.postcode && <InfoRow label="Postcode" value={lead.postcode} />}
            {lead.leadSource && <InfoRow label="Lead Source" value={capitalise(lead.leadSource)} />}
          </>
        ) : (
          <p style={{ color: '#6b7280', fontSize: 13 }}>Loading...</p>
        )}
      </div>

      {/* Conversation Status */}
      <div className={styles.infoCard}>
        <h3 className={styles.cardTitle}>Conversation Status</h3>
        <div className={styles.infoRow}>
          <div className={styles.infoLabel}>Phase</div>
          <span className={`${styles.phaseBadge} ${phaseClass}`}>
            {phase.charAt(0).toUpperCase() + phase.slice(1)}
          </span>
        </div>
        {clinic && <InfoRow label="Clinic" value={clinic.name} />}
        {clinic?.tone && <InfoRow label="Tone" value={capitalise(clinic.tone)} />}
        <InfoRow label="Messages" value={String(messageCount)} />
      </div>
    </div>
  );
}

/** Reusable label/value pair for info cards */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  );
}
