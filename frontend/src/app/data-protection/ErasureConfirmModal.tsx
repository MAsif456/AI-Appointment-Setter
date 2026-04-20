import { type ErasureRequest, getPatientName } from './ErasureRequestCard';
import styles from './page.module.css';

interface ErasureConfirmModalProps {
  request: ErasureRequest;
  type: 'approve' | 'reject';
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Centred confirmation modal for approving or rejecting
 * an erasure request. Shows patient details and, for rejections,
 * a textarea for the reason.
 */
export default function ErasureConfirmModal({
  request,
  type,
  rejectReason,
  onRejectReasonChange,
  isLoading,
  onConfirm,
  onCancel,
}: ErasureConfirmModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>
          {type === 'approve' ? 'Approve Erasure Request' : 'Reject Erasure Request'}
        </h3>
        <p className={styles.modalDesc}>
          {type === 'approve'
            ? 'This will permanently erase all data for this patient. This action cannot be undone.'
            : 'Please provide a reason for rejecting this erasure request.'}
        </p>

        <div className={styles.modalInfo}>
          <div className={styles.modalInfoRow}>
            <span className={styles.modalInfoLabel}>Patient</span>
            <span className={styles.modalInfoValue}>{getPatientName(request)}</span>
          </div>
          <div className={styles.modalInfoRow}>
            <span className={styles.modalInfoLabel}>Reason</span>
            <span className={styles.modalInfoValue}>{request.reason}</span>
          </div>
        </div>

        {type === 'reject' && (
          <textarea
            className={styles.rejectInput}
            placeholder="Reason for rejection (optional)..."
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            rows={3}
          />
        )}

        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={type === 'approve' ? styles.modalApproveBtn : styles.modalRejectBtn}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? 'Processing...'
              : type === 'approve' ? 'Confirm & Erase Data' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}
