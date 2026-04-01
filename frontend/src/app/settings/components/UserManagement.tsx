'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, ChevronLeft, ChevronRight, UserPlus, Shield, Users as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/apiAxios';
import UserModal from './UserModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import styles from '../settings.module.css';

export interface StaffUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  isVerified: boolean;
  assignedClinics: { _id: string; name: string; address?: string }[];
}

export interface Clinic { _id: string; name: string; address?: string; }

/** How often to silently re-fetch users to pick up verification status changes */
const POLL_INTERVAL_MS = 10_000;

/**
 * User Management tab — lists all users with pagination (5 per page).
 * Polls every 10 seconds so verification status updates automatically
 * when a staff member verifies their email without the admin needing to refresh.
 */
export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<StaffUser | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string, duration = 4000) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  };

  /**
   * Fetches users. Pass silent=true from the polling interval so the
   * loading spinner doesn't flicker every 10 seconds.
   */
  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/users?page=${page}`);
      setUsers(res.data.users);
      setTotalPages(res.data.totalPages);
    } catch {
      if (!silent) showToast('error', 'Failed to load users');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { api.get('/clinics').then(r => setClinics(r.data)).catch(() => {}); }, []);

  // Poll every 10 seconds to pick up verification status changes automatically
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUsers(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      await api.delete(`/users/${deleteUser._id}`);
      showToast('success', 'User deleted successfully');
      setDeleteUser(null);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete user');
      setDeleteUser(null);
    }
  };

  const onModalSuccess = (message: string, duration = 4000) => {
    setShowAdd(false);
    setEditUser(null);
    fetchUsers();
    showToast('success', message, duration);
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>User Management</h2>
          <p className={styles.sectionDesc}>Manage staff accounts and permissions</p>
        </div>
        <button className={styles.primaryButton} onClick={() => setShowAdd(true)}>
          <UserPlus size={18} /> Add Staff Member
        </button>
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.userList}>
        {loading ? (
          <div className={styles.loadingState}>Loading users...</div>
        ) : users.length === 0 ? (
          <div className={styles.emptyState}>No users configured yet</div>
        ) : (
          users.map(u => (
            <div key={u._id} className={styles.userCard}>
              <div className={styles.userAvatar}>
                {u.role === 'admin' ? <Shield size={20} /> : <UserIcon size={20} />}
              </div>
              <div className={styles.userCardInfo}>
                <div className={styles.userCardName}>{u.name}</div>
                <div className={styles.userCardEmail}>{u.email}</div>
                <div className={styles.userCardMeta}>
                  <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeStaff}`}>
                    {u.role === 'admin' ? 'Administrator' : 'Staff'}
                  </span>
                  {u.role === 'staff' && (
                    <span className={styles.clinicCount}>
                      {u.assignedClinics.length} {u.assignedClinics.length === 1 ? 'clinic' : 'clinics'}
                    </span>
                  )}
                  {!u.isVerified && <span className={styles.unverifiedBadge}>Unverified</span>}
                </div>
              </div>
              <div className={styles.userCardActions}>
                <button className={styles.iconButton} onClick={() => setEditUser(u)} title="Edit user">
                  <Pencil size={16} />
                </button>
                {u._id !== currentUser?._id && (
                  <button className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                    onClick={() => setDeleteUser(u)} title="Delete user">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageButton} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </button>
          <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
          <button className={styles.pageButton} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {showAdd && (
        <UserModal mode="add" clinics={clinics} onClose={() => setShowAdd(false)}
          onSuccess={() => onModalSuccess('User created. Ask the user to check their email to verify their account.', 8000)} />
      )}

      {editUser && (
        <UserModal mode="edit" user={editUser} clinics={clinics} onClose={() => setEditUser(null)}
          onSuccess={() => onModalSuccess('User updated successfully')} />
      )}

      {deleteUser && (
        <DeleteConfirmModal user={deleteUser} onConfirm={handleDelete} onCancel={() => setDeleteUser(null)} />
      )}
    </div>
  );
}