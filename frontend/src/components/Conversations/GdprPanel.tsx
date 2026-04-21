'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/apiAxios';
import { useAuth } from '@/contexts/AuthContext';
import styles from './GdprPanel.module.css';

interface ConsentRecord {
  _id: string;
  status: 'granted' | 'declined' | 'withdrawn';
  consentStatementVersion: string;
  channel: string;
  createdAt: string;
}

interface GdprPanelProps {
  leadId: string;
}

const STATUS_LABEL: Record<string, string> = {
  granted: 'Granted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

/** Data Protection panel — consent history and patient data erasure (UK GDPR Art. 7, 17). */
export default function GdprPanel({ leadId }: GdprPanelProps) {
  const { isAdmin } = useAuth();
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');

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

  /** Admin: direct erasure. Staff: request erasure (requires admin approval). */
  const handleSubmit = async () => {
    if (!isAdmin && !reason.trim()) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setResult(null);
    try {
      if (isAdmin) {
        await api.delete(`/gdpr/erasure/${leadId}`);
        setResult('Patient data erased successfully.');
      } else {
        await api.post(`/gdpr/erasure-requests/${leadId}`, { reason: reason.trim() });
        setResult('Erasure request submitted. Awaiting admin approval.');
      }
      setReason('');
      fetchConsent();
    } catch (err: any) {
      setResult(err.response?.data?.message || 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Data Protection</h3>

      <div className={styles.subHeading}>Consent History</div>
      {loading ? (
        <p className={styles.muted}>Loading...</p>
      ) : consentHistory.length === 0 ? (
        <p className={styles.muted}>No consent records found.</p>
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
                {STATUS_LABEL[record.status] ?? record.status}
              </span>
              <span className={styles.consentDate}>
                {new Date(record.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result && (
        <p role="status" className={styles.result}>{result}</p>
      )}

      <button
        className={styles.eraseBtn}
        onClick={() => setConfirmOpen(true)}
        disabled={submitting}
      >
        {isAdmin ? 'Delete Patient Data' : 'Request Data Deletion'}
      </button>

      {confirmOpen && (
        <div className={styles.overlay} onClick={() => setConfirmOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {isAdmin ? 'Delete Patient Data' : 'Request Data Deletion'}
            </h3>
            <p className={styles.modalText}>
              {isAdmin
                ? 'This will permanently anonymise all personal data for this patient. This action cannot be undone.'
                : 'This will send an erasure request to an admin for approval.'}
            </p>
            {!isAdmin && (
              <textarea
                className={styles.reasonInput}
                placeholder="Reason for erasure request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            )}
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleSubmit}
                disabled={submitting || (!isAdmin && !reason.trim())}
              >
                {isAdmin ? 'Confirm Delete' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
