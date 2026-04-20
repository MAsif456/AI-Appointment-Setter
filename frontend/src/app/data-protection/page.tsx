'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/apiAxios';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';

interface ErasureRequest {
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

export default function DataProtectionPage() {
  const { isAdmin } = useAuth();
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
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

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await api.post(`/gdpr/erasure-requests/${requestId}/reject`, {
        reason: rejectReason,
      });
      setConfirmModal(null);
      setRejectingId(null);
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

  // Find the request associated with the active modal
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
              <h2 className={styles.sectionTitle}>
                Pending Requests ({pending.length})
              </h2>
              <div className={styles.cardGrid}>
                {pending.map((req) => (
                  <div key={req._id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.badgePending}>Pending</span>
                      <span className={styles.date}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.field}>
                        <span className={styles.label}>Patient</span>
                        <span className={styles.value}>
                          {req.leadId
                            ? `${req.leadId.firstName} ${req.leadId.lastName || ''}`.trim()
                            : 'Unknown'}
                        </span>
                      </div>
                      <div className={styles.field}>
                        <span className={styles.label}>Requested by</span>
                        <span className={styles.value}>{req.requestedBy}</span>
                      </div>
                      <div className={styles.field}>
                        <span className={styles.label}>Reason</span>
                        <span className={styles.value}>{req.reason}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className={styles.cardActions}>
                        <button
                          className={styles.approveBtn}
                          onClick={() => setConfirmModal({ id: req._id, type: 'approve' })}
                          disabled={actionLoading === req._id}
                        >
                          Approve
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => setConfirmModal({ id: req._id, type: 'reject' })}
                          disabled={actionLoading === req._id}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section>
              <h2 className={styles.sectionTitle}>
                Resolved ({resolved.length})
              </h2>

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
                        <span className={
                          req.status === 'approved'
                            ? styles.badgeApproved
                            : styles.badgeRejected
                        }>
                          {req.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td>{req.requestedBy}</td>
                      <td>{req.reviewedBy ?? '—'}</td>
                      <td className={styles.reasonCell}>
                        {req.status === 'rejected' && req.rejectionReason
                          ? req.rejectionReason
                          : req.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {/* ── Centered confirmation modal for approve / reject ── */}
      {confirmModal && modalRequest && (
        <div className={styles.modalOverlay} onClick={() => { setConfirmModal(null); setRejectReason(''); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {confirmModal.type === 'approve' ? 'Approve Erasure Request' : 'Reject Erasure Request'}
            </h3>
            <p className={styles.modalDesc}>
              {confirmModal.type === 'approve'
                ? 'This will permanently erase all data for this patient. This action cannot be undone.'
                : 'Please provide a reason for rejecting this erasure request.'}
            </p>

            <div className={styles.modalInfo}>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalInfoLabel}>Patient</span>
                <span className={styles.modalInfoValue}>
                  {modalRequest.leadId
                    ? `${modalRequest.leadId.firstName} ${modalRequest.leadId.lastName || ''}`.trim()
                    : 'Unknown'}
                </span>
              </div>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalInfoLabel}>Reason</span>
                <span className={styles.modalInfoValue}>{modalRequest.reason}</span>
              </div>
            </div>

            {confirmModal.type === 'reject' && (
              <textarea
                className={styles.rejectInput}
                placeholder="Reason for rejection (optional)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            )}

            <div className={styles.modalActions}>
              <button
                className={styles.modalCancelBtn}
                onClick={() => { setConfirmModal(null); setRejectReason(''); }}
              >
                Cancel
              </button>
              <button
                className={confirmModal.type === 'approve' ? styles.modalApproveBtn : styles.modalRejectBtn}
                onClick={() => confirmModal.type === 'approve'
                  ? handleApprove(confirmModal.id)
                  : handleReject(confirmModal.id)}
                disabled={actionLoading === confirmModal.id}
              >
                {actionLoading === confirmModal.id
                  ? 'Processing...'
                  : confirmModal.type === 'approve' ? 'Confirm & Erase Data' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
