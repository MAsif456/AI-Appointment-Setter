'use client';

import { useState } from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';
import api from '@/lib/apiAxios';
import { StaffUser, Clinic } from './UserManagement';
import styles from '../settings.module.css';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

interface Props {
  mode: 'add' | 'edit';
  user?: StaffUser;
  clinics: Clinic[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal form for creating or editing a user account.
 * In 'add' mode, sends to POST /auth/create-user (admin-only).
 * In 'edit' mode, sends to PATCH /users/:id.
 * Staff role requires at least one assigned clinic to be selected.
 */
export default function UserModal({ mode, user, clinics, onClose, onSuccess }: Props) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'admin' | 'staff'>(user?.role || 'staff');
  const [selectedClinics, setSelectedClinics] = useState<string[]>(
    user?.assignedClinics.map(c => c._id) || [],
  );
  const [clinicSearch, setClinicSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(clinicSearch.toLowerCase()),
  );

  /** Toggles a clinic in/out of the selected list */
  const toggleClinic = (id: string) =>
    setSelectedClinics(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const clinicsInvalid = role === 'staff' && selectedClinics.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (clinicsInvalid) {
      setError('Staff members must have at least one clinic assigned');
      return;
    }
    if (mode === 'add' && !PASSWORD_REGEX.test(password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number and special character');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'add') {
        await api.post('/auth/create-user', {
          name, email, password, role,
          assignedClinics: selectedClinics,
        });
      } else {
        await api.patch(`/users/${user!._id}`, {
          name, email, role,
          assignedClinics: role === 'admin' ? [] : selectedClinics,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modal} ${styles.modalLarge}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{mode === 'add' ? 'Add Staff Member' : 'Edit User'}</h3>
          <button className={styles.closeButton} onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Full Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className={styles.input} />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Email Address *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={styles.input} />
          </div>

          {mode === 'add' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Password *</label>
              <div className={styles.passwordWrapper}>
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Enter password" required className={styles.input} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeButton}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Role selection */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Role *</label>
            <div className={styles.roleOptions}>
              {(['admin', 'staff'] as const).map(r => (
                <label key={r} className={`${styles.roleOption} ${role === r ? styles.roleOptionActive : ''}`}>
                  <input type="radio" value={r} checked={role === r} onChange={() => setRole(r)} />
                  <div>
                    <div className={styles.roleOptionTitle}>
                      {r === 'admin' ? 'Administrator' : 'Staff Member'}
                    </div>
                    <div className={styles.roleOptionDesc}>
                      {r === 'admin' ? 'Full access to all clinics and settings' : 'Limited access to assigned clinics only'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Clinic assignment — only shown for staff role */}
          {role === 'staff' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Assigned Clinics *</label>
              <p className={styles.labelDesc}>Select which clinics this staff member can manage</p>
              <div className={styles.clinicSearch}>
                <Search size={14} className={styles.clinicSearchIcon} />
                <input type="text" placeholder="Search clinics..." value={clinicSearch}
                  onChange={e => setClinicSearch(e.target.value)} className={styles.clinicSearchInput} />
              </div>
              <div className={styles.clinicList}>
                {filteredClinics.map(c => (
                  <label key={c._id} className={styles.clinicItem}>
                    <input type="checkbox" checked={selectedClinics.includes(c._id)}
                      onChange={() => toggleClinic(c._id)} className={styles.clinicCheckbox} />
                    <div>
                      <div className={styles.clinicName}>{c.name}</div>
                      {c.address && <div className={styles.clinicAddress}>{c.address}</div>}
                    </div>
                  </label>
                ))}
              </div>
              {clinicsInvalid && <p className={styles.clinicError}>Staff members must have at least one clinic assigned</p>}
              {selectedClinics.length > 0 && (
                <p className={styles.clinicCount}>{selectedClinics.length} clinic{selectedClinics.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={styles.outlineButton} onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading || clinicsInvalid} className={styles.primaryButton}>
              {loading ? 'Saving...' : mode === 'add' ? 'Create User' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}