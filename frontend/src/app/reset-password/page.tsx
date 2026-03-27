'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import api from '@/lib/apiAxios';
import styles from './reset.module.css';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Handles the password reset form.
 * The reset token is extracted from the URL — the user never sees or types it.
 * They just enter their new password and confirm it.
 */
function ResetPasswordContent() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) {
      setError('Invalid reset link. Please request a new password reset.');
    } else {
      setToken(t);
    }
  }, [searchParams]);

  const handlePasswordChange = (value: string) => {
    setNewPassword(value);
    setPasswordError(
      value && !PASSWORD_REGEX.test(value)
        ? 'Password must be at least 8 characters with uppercase, lowercase, number and special character'
        : '',
    );
  };

  const handleConfirmChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmError(value && value !== newPassword ? 'Passwords do not match' : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PASSWORD_REGEX.test(newPassword)) {
      setPasswordError('Password does not meet requirements');
      return;
    }
    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Backend now takes { token, newPassword } — no email or code needed
      await api.post('/auth/reset-password', { token, newPassword });
      router.push('/login?reset=true');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    !!token && PASSWORD_REGEX.test(newPassword) &&
    newPassword === confirmPassword && !passwordError && !confirmError;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => router.back()}>
            <ArrowLeft size={18} /> Back
          </button>
          <h1 className={styles.title}>
            AppointHealth <span className={styles.titleHighlight}>AI</span>
          </h1>
          <p className={styles.subtitle}>Set a new password</p>
          <p className={styles.description}>
            Enter your new password below.
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {token && (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>New Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={styles.input}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeButton}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && <p className={styles.fieldError}>{passwordError}</p>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Confirm Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => handleConfirmChange(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={styles.input}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className={styles.eyeButton}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmError && <p className={styles.fieldError}>{confirmError}</p>}
            </div>

            <button type="submit" disabled={loading || !isFormValid} className={styles.submitButton}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}