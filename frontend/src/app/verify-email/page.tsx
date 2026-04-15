'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/apiAxios';
import styles from './verify.module.css';

/**
 * Handles email verification via the link sent to the user's inbox.
 * The token is extracted from the URL query param and sent to the backend automatically.
 * No form entry needed — the user just clicks the link.
 */
function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. Please contact an admin to resend the link.');
      return;
    }

    // Automatically verify using the token from the link
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => {
        setStatus('success');
        setMessage('Email verified successfully. You can now log in.');
        // Redirect to login after 3 seconds
        setTimeout(() => router.push('/login?verified=true'), 3000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
          'Verification link is invalid or has expired. Please contact an admin.',
        );
      });
  }, [searchParams, router]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            AppointHealth <span className={styles.titleHighlight}>AI</span>
          </h1>
          <p className={styles.subtitle}>Email Verification</p>
        </div>

        {status === 'loading' && (
          <div className={styles.statusBox}>
            <div className={styles.spinner} />
            <p className={styles.statusText}>Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className={`${styles.statusBox} ${styles.success}`}>
            <div className={styles.checkIcon}>✓</div>
            <p className={styles.statusText}>{message}</p>
            <p className={styles.redirect}>Redirecting you to login...</p>
          </div>
        )}

        {status === 'error' && (
          <div className={`${styles.statusBox} ${styles.error}`}>
            <div className={styles.errorIcon}>✕</div>
            <p className={styles.statusText}>{message}</p>
            <button className={styles.button} onClick={() => router.push('/login')}>
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}