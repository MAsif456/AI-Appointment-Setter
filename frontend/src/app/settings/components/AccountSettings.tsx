'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/apiAxios';
import styles from '../settings.module.css';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Account Settings tab — shows the logged-in user's profile info
 * and an inline change-password form that expands on demand.
 */
export default function AccountSettings() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  /** Validates new password complexity in real time */
  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setPasswordError(
      value && !PASSWORD_REGEX.test(value)
        ? 'Minimum 8 characters with uppercase, lowercase, number and special character'
        : '',
    );
  };

  /** Validates confirm password matches in real time */
  const handleConfirmChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmError(value && value !== newPassword ? 'Passwords do not match' : '');
  };

  const resetForm = () => {
    setShowForm(false);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setError(''); setPasswordError(''); setConfirmError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PASSWORD_REGEX.test(newPassword) || newPassword !== confirmPassword) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess('Password updated successfully.');
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !!currentPassword && PASSWORD_REGEX.test(newPassword) &&
    newPassword === confirmPassword && !passwordError && !confirmError;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Account Information</h2>
      </div>

      <div className={styles.infoCard}>
        {/* Profile fields — read only */}
        {[
          { label: 'Full Name', value: user?.name },
          { label: 'Email Address', value: user?.email },
        ].map(field => (
          <div key={field.label} className={styles.infoField}>
            <label className={styles.infoLabel}>{field.label}</label>
            <div className={styles.infoValue}>{field.value}</div>
          </div>
        ))}

        <div className={styles.infoField}>
          <label className={styles.infoLabel}>Role</label>
          <div className={styles.infoValue}>
            <span className={styles.roleBadge}>
              {user?.role === 'admin' ? 'Administrator' : 'Staff Member'}
            </span>
          </div>
        </div>

        {success && <div className={styles.successAlert}>{success}</div>}

        {/* Change password — hidden until button is clicked */}
        {!showForm ? (
          <button className={styles.outlineButton} onClick={() => setShowForm(true)}>
            Change Password
          </button>
        ) : (
          <form onSubmit={handleSubmit} className={styles.passwordForm}>
            <div className={styles.passwordFormHeader}>
              <span className={styles.passwordFormTitle}>Change Password</span>
              <button type="button" className={styles.cancelLink} onClick={resetForm}>
                Cancel
              </button>
            </div>

            {error && <div className={styles.errorAlert}>{error}</div>}

            {/* Current password field */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Current Password *</label>
              <div className={styles.passwordWrapper}>
                <input type={showCurrent ? 'text' : 'password'} value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password" required className={styles.input} />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className={styles.eyeButton}>
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New password field */}
            <div className={styles.formGroup}>
              <label className={styles.label}>New Password *</label>
              <div className={styles.passwordWrapper}>
                <input type={showNew ? 'text' : 'password'} value={newPassword}
                  onChange={(e) => handleNewPasswordChange(e.target.value)}
                  placeholder="Enter new password" required className={styles.input} />
                <button type="button" onClick={() => setShowNew(!showNew)} className={styles.eyeButton}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && <p className={styles.fieldError}>{passwordError}</p>}
            </div>

            {/* Confirm new password field */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Confirm New Password *</label>
              <div className={styles.passwordWrapper}>
                <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                  onChange={(e) => handleConfirmChange(e.target.value)}
                  placeholder="Confirm new password" required className={styles.input} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className={styles.eyeButton}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmError && <p className={styles.fieldError}>{confirmError}</p>}
            </div>

            <button type="submit" disabled={loading || !canSubmit} className={styles.primaryButton}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}