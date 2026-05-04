import styles from './integrations.module.css';

interface DisconnectConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal overlay prompting the user to confirm integration removal. */
export default function DisconnectConfirmModal({ onConfirm, onCancel }: DisconnectConfirmModalProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>Remove integration?</h3>
        <p className={styles.panelDesc}>
          Are you sure? This will stop all AI booking services for this clinic. You can reconnect at any time.
        </p>
        <div className={styles.panelActions}>
          <button className={styles.btnConfirmCancel} onClick={onCancel}>Cancel</button>
          <button className={styles.btnConfirmDanger} onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}
