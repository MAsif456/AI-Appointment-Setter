'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/apiAxios';
import UserModal from './UserModal';
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

/**
 * User Management tab — lists all users with pagination (5 per page),
 * and provides add, edit, and delete actions.
 * Only rendered for admin users.
 */
export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<StaffUser | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  /** Shows a toast notification that auto-dismisses after 4 seconds */
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users?page=${page}`);
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      showToast('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { api.get('/clinics').then(r => setClinics(r.data)).catch(() => {}); }, []);

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      await api.delete(`/users/${deleteUser._id}`);
      showToast('success', 'User deleted successfully');
      setDeleteUser(null);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete user');
    }
  };

  const onModalSuccess = (message: string) => {
    setShowAdd(false);
    setEditUser(null);
    fetchUsers();
    showToast('success', message);
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>User Management</h2>
          <p className={styles.sectionDesc}>Manage staff accounts and permissions</p>
        </div>
        <button className={styles.primaryButton} onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Staff Member
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
              <div className={styles.userAvatar}>{u.role === 'admin' ? '🛡' : '👤'}</div>
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
                {/* Prevent admin from deleting their own account */}
                {u._id !== currentUser?._id && (
                  <button className={`${styles.iconButton} ${styles.iconButtonDanger}`} onClick={() => setDeleteUser(u)} title="Delete user">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination — only shown when there is more than one page */}
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
          onSuccess={() => onModalSuccess('User created. A verification link has been sent.')} />
      )}

      {editUser && (
        <UserModal mode="edit" user={editUser} clinics={clinics} onClose={() => setEditUser(null)}
          onSuccess={() => onModalSuccess('User updated successfully')} />
      )}

      {/* Delete confirmation modal */}
      {deleteUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Delete User</h3>
            <p className={styles.modalDesc}>
              Are you sure you want to delete <strong>{deleteUser.name}</strong>? This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.outlineButton} onClick={() => setDeleteUser(null)}>Cancel</button>
              <button className={styles.dangerButton} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}