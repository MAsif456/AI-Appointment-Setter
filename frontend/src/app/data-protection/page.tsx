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
                        {rejectingId === req._id ? (
                          <div className={styles.rejectForm}>
                            <textarea
                              className={styles.rejectInput}
                              placeholder="Reason for rejection (optional)..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              rows={2}
                            />
                            <div className={styles.rejectButtons}>
                              <button
                                className={styles.rejectConfirmBtn}
                                onClick={() => handleReject(req._id)}
                                disabled={actionLoading === req._id}
                              >
                                Confirm Reject
                              </button>
                              <button
                                className={styles.cancelBtn}
                                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              className={styles.approveBtn}
                              onClick={() => handleApprove(req._id)}
                              disabled={actionLoading === req._id}
                            >
                              {actionLoading === req._id ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              className={styles.rejectBtn}
                              onClick={() => setRejectingId(req._id)}
                              disabled={actionLoading === req._id}
                            >
                              Reject
                            </button>
                          </>
                        )}
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
              <div className={styles.cardGrid}>
                {resolved.map((req) => (
                  <div key={req._id} className={`${styles.card} ${styles.cardResolved}`}>
                    <div className={styles.cardHeader}>
                      <span className={
                        req.status === 'approved'
                          ? styles.badgeApproved
                          : styles.badgeRejected
                      }>
                        {req.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
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
                            : '[Redacted]'}
                        </span>
                      </div>
                      <div className={styles.field}>
                        <span className={styles.label}>Requested by</span>
                        <span className={styles.value}>{req.requestedBy}</span>
                      </div>
                      <div className={styles.field}>
                        <span className={styles.label}>Reviewed by</span>
                        <span className={styles.value}>{req.reviewedBy ?? '—'}</span>
                      </div>
                      {req.rejectionReason && (
                        <div className={styles.field}>
                          <span className={styles.label}>Rejection reason</span>
                          <span className={styles.value}>{req.rejectionReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
