import styles from '../settings.module.css';
import { StaffUser } from './UserManagement';

interface Props {
  user: StaffUser;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal shown before deleting a user account.
 * Extracted from UserManagement to keep that file under 200 lines.
 */
export default function DeleteConfirmModal({ user, onConfirm, onCancel }: Props) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Delete User</h3>
        <p className={styles.modalDesc}>
          Are you sure you want to delete <strong>{user.name}</strong>? This cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <button className={styles.outlineButton} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.dangerButton} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}