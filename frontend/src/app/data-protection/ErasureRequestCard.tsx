import styles from './page.module.css';

/** Shape of a single erasure request from the API. */
export interface ErasureRequest {
  _id: string;
  leadId: { _id: string; firstName: string; lastName: string } | null;
  clinicId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  reviewedBy?: string;
  reason: string;
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt: string;
}

/** Returns the patient's full name, falling back to 'Unknown'. */
export function getPatientName(req: ErasureRequest): string {
  if (!req.leadId) return 'Unknown';
  return `${req.leadId.firstName} ${req.leadId.lastName || ''}`.trim();
}

interface ErasureRequestCardProps {
  request: ErasureRequest;
  isAdmin: boolean;
  isLoading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

/** Displays a single pending erasure request as a card with admin actions. */
export default function ErasureRequestCard({
  request,
  isAdmin,
  isLoading,
  onApprove,
  onReject,
}: ErasureRequestCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.badgePending}>Pending</span>
        <span className={styles.date}>
          {new Date(request.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.field}>
          <span className={styles.label}>Patient</span>
          <span className={styles.value}>{getPatientName(request)}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Requested by</span>
          <span className={styles.value}>{request.requestedBy}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Reason</span>
          <span className={styles.value}>{request.reason}</span>
        </div>
      </div>
      {isAdmin && (
        <div className={styles.cardActions}>
          <button
            className={styles.approveBtn}
            onClick={() => onApprove(request._id)}
            disabled={isLoading}
          >
            Approve
          </button>
          <button
            className={styles.rejectBtn}
            onClick={() => onReject(request._id)}
            disabled={isLoading}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
