'use client';

import { useState } from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';
import api from '@/lib/apiAxios';
import { StaffUser, Clinic } from './UserManagement';
import styles from '../settings.module.css';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * All validation is inline below each field — no browser native validation,
 * no banner errors for field issues. The submit button is disabled until
 * the form is fully valid.
 */
export default function UserModal({ mode, user, clinics, onClose, onSuccess }: Props) {
  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'admin' | 'staff'>(user?.role || 'staff');
  const [selectedClinics, setSelectedClinics] = useState<string[]>(
    user?.assignedClinics.map(c => c._id) || [],
  );
  const [clinicSearch, setClinicSearch] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(clinicSearch.toLowerCase()),
  );

  /** Toggles a clinic in/out of the selected list */
  const toggleClinic = (id: string) =>
    setSelectedClinics(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );

  const clinicsInvalid = role === 'staff' && selectedClinics.length === 0;

  /** Validates name in real time */
  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(value.trim().length === 0 ? 'Full name is required' : '');
  };

  /** Validates email format in real time */
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (!value) {
      setEmailError('Email address is required');
    } else if (!EMAIL_REGEX.test(value)) {
      setEmailError('Please provide a valid email address');
    } else {
      setEmailError('');
    }
  };

  /** Validates password complexity in real time */
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (!value) {
      setPasswordError('Password is required');
    } else if (!PASSWORD_REGEX.test(value)) {
      setPasswordError('Minimum 8 characters with uppercase, lowercase, number and special character');
    } else {
      setPasswordError('');
    }
  };

  /**
   * Whether the form is fully valid and ready to submit.
   * All fields must pass their individual checks.
   */
  const isFormValid = () => {
    if (!name.trim() || nameError) return false;
    if (!email || emailError) return false;
    if (mode === 'add' && (!password || passwordError)) return false;
    if (clinicsInvalid) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    // Trigger all validations on submit in case fields were never touched
    if (!name.trim()) { setNameError('Full name is required'); return; }
    if (!email) { setEmailError('Email address is required'); return; }
    if (!EMAIL_REGEX.test(email)) { setEmailError('Please provide a valid email address'); return; }
    if (mode === 'add' && !PASSWORD_REGEX.test(password)) {
      setPasswordError('Minimum 8 characters with uppercase, lowercase, number and special character');
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
      // Only API-level errors (e.g. duplicate email) show as a banner
      setApiError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modal} ${styles.modalLarge}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {mode === 'add' ? 'Add Staff Member' : 'Edit User'}
          </h3>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Only API errors (e.g. duplicate email from backend) show as a banner */}
        {apiError && <div className={styles.errorAlert}>{apiError}</div>}

        <form onSubmit={handleSubmit} className={styles.modalForm} noValidate>

          {/* Full Name */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              onBlur={() => { if (!name.trim()) setNameError('Full name is required'); }}
              placeholder="Enter full name"
              className={styles.input}
            />
            {nameError && <p className={styles.fieldError}>{nameError}</p>}
          </div>

          {/* Email Address */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={e => handleEmailChange(e.target.value)}
              onBlur={() => { if (!email) setEmailError('Email address is required'); }}
              placeholder="Enter email address"
              className={styles.input}
            />
            {emailError && <p className={styles.fieldError}>{emailError}</p>}
          </div>

          {/* Password — add mode only */}
          {mode === 'add' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Password *</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => handlePasswordChange(e.target.value)}
                  onBlur={() => { if (!password) setPasswordError('Password is required'); }}
                  placeholder="Enter password"
                  className={styles.input}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.eyeButton}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && <p className={styles.fieldError}>{passwordError}</p>}
            </div>
          )}

          {/* Role selection */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Role *</label>
            <div className={styles.roleOptions}>
              {(['admin', 'staff'] as const).map(r => (
                <label
                  key={r}
                  className={`${styles.roleOption} ${role === r ? styles.roleOptionActive : ''}`}
                >
                  <input
                    type="radio"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                  />
                  <div>
                    <div className={styles.roleOptionTitle}>
                      {r === 'admin' ? 'Administrator' : 'Staff Member'}
                    </div>
                    <div className={styles.roleOptionDesc}>
                      {r === 'admin'
                        ? 'Full access to all clinics and settings'
                        : 'Limited access to assigned clinics only'}
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
              <p className={styles.labelDesc}>
                Select which clinics this staff member can manage
              </p>
              <div className={styles.clinicSearch}>
                <Search size={14} className={styles.clinicSearchIcon} />
                <input
                  type="text"
                  placeholder="Search clinics..."
                  value={clinicSearch}
                  onChange={e => setClinicSearch(e.target.value)}
                  className={styles.clinicSearchInput}
                />
              </div>
              <div className={styles.clinicList}>
                {filteredClinics.map(c => (
                  <label key={c._id} className={styles.clinicItem}>
                    <input
                      type="checkbox"
                      checked={selectedClinics.includes(c._id)}
                      onChange={() => toggleClinic(c._id)}
                      className={styles.clinicCheckbox}
                    />
                    <div>
                      <div className={styles.clinicName}>{c.name}</div>
                      {c.address && (
                        <div className={styles.clinicAddress}>{c.address}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {clinicsInvalid && (
                <p className={styles.clinicError}>
                  Staff members must have at least one clinic assigned
                </p>
              )}
              {selectedClinics.length > 0 && (
                <p className={styles.clinicCount}>
                  {selectedClinics.length} clinic{selectedClinics.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={styles.outlineButton} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid()}
              className={styles.primaryButton}
            >
              {loading ? 'Saving...' : mode === 'add' ? 'Create User' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}