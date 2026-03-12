'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/apiAxios';
import styles from './verify.module.css';

function VerifyEmailContent() {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (code.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }
    
    setLoading(true);

    try {
      await api.post('/auth/verify-email', { email, code });
      router.push('/login?verified=true');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/auth/resend-code', { email });
      setSuccess('Verification code resent. Please check your email.');
    } catch (err: any) {
      setError('Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            AppointHealth <span className={styles.titleHighlight}>AI</span>
          </h1>
          <p className={styles.subtitle}>Verify your email</p>
          <p className={styles.description}>
            Enter the verification code sent to {email}
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}


        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="code" className={styles.label}>
              Verification Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} // Only allow digits
              placeholder="123456"
              required
              maxLength={6}
              className={styles.codeInput}
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className={styles.submitButton}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <div className={styles.footer}>
          Didn't receive the code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className={styles.linkButton}
          >
            {resending ? 'Sending...' : 'Resend Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}