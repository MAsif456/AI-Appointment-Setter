'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/apiAxios';
import { useAuth } from '@/contexts/AuthContext';
import ErasureRequestCard, { type ErasureRequest } from './ErasureRequestCard';
import ErasureConfirmModal from './ErasureConfirmModal';
import styles from './page.module.css';

/**
 * Data Protection page — lists pending and resolved erasure requests.
 * Admin users can approve or reject pending requests via a confirmation modal.
 */
export default function DataProtectionPage() {
  const { isAdmin } = useAuth();
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/gdpr/erasure-requests');
      setRequests(res.data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  /** Approves the erasure request and refreshes the list. */
  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await api.post(`/gdpr/erasure-requests/${requestId}/approve`);
      setConfirmModal(null);
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  /** Rejects the erasure request with an optional reason. */
  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await api.post(`/gdpr/erasure-requests/${requestId}/reject`, { reason: rejectReason });
      setConfirmModal(null);
      setRejectReason('');
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Rejection failed');
    } finally {
      setActionLoading(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');
  const approvedCount = resolved.filter((r) => r.status === 'approved').length;
  const rejectedCount = resolved.filter((r) => r.status === 'rejected').length;
  const modalRequest = confirmModal ? requests.find((r) => r._id === confirmModal.id) : null;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Data Protection</h1>
      <p className={styles.subtitle}>
        {isAdmin
          ? 'Review and manage patient data erasure requests (UK GDPR Art. 17).'
          : 'Your data erasure requests.'}
      </p>

      {loading ? (
        <p>Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className={styles.emptyState}>No erasure requests found.</div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className={styles.sectionTitle}>Pending Requests ({pending.length})</h2>
              <div className={styles.cardGrid}>
                {pending.map((req) => (
                  <ErasureRequestCard
                    key={req._id}
                    request={req}
                    isAdmin={isAdmin}
                    isLoading={actionLoading === req._id}
                    onApprove={(id) => setConfirmModal({ id, type: 'approve' })}
                    onReject={(id) => setConfirmModal({ id, type: 'reject' })}
                  />
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section>
              <h2 className={styles.sectionTitle}>Resolved ({resolved.length})</h2>
              <div className={styles.resolvedSummary}>
                <div className={styles.summaryChip}>
                  <span className={styles.summaryCount}>{approvedCount}</span>
                  <span className={styles.summaryLabel}>Approved</span>
                </div>
                <div className={styles.summaryChip}>
                  <span className={styles.summaryCount}>{rejectedCount}</span>
                  <span className={styles.summaryLabel}>Rejected</span>
                </div>
              </div>
              <table className={styles.resolvedTable}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Requested By</th>
                    <th>Reviewed By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((req) => (
                    <tr key={req._id}>
                      <td>
                        <span className={req.status === 'approved' ? styles.badgeApproved : styles.badgeRejected}>
                          {req.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      </td>
                      <td className={styles.dateCell}>{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td>{req.requestedBy}</td>
                      <td>{req.reviewedBy ?? '—'}</td>
                      <td className={styles.reasonCell}>
                        {req.status === 'rejected' && req.rejectionReason ? req.rejectionReason : req.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {confirmModal && modalRequest && (
        <ErasureConfirmModal
          request={modalRequest}
          type={confirmModal.type}
          rejectReason={rejectReason}
          onRejectReasonChange={setRejectReason}
          isLoading={actionLoading === confirmModal.id}
          onConfirm={() =>
            confirmModal.type === 'approve'
              ? handleApprove(confirmModal.id)
              : handleReject(confirmModal.id)
          }
          onCancel={() => { setConfirmModal(null); setRejectReason(''); }}
        />
      )}
    </div>
  );
}
