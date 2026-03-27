'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/apiAxios';
import styles from './forgot.module.css';

/**
 * Forgot password page.
 * On success: shows a confirmation message on the same page.
 * Does NOT redirect to reset-password — the user clicks the link in their email.
 * Invalid/expired link errors are handled on the reset-password page itself.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setError('');
    setEmailError(value && !validateEmail(value) ? 'Invalid email address' : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setEmailError('Invalid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      // Show success message on this page — user clicks the link in their email
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            AppointHealth <span className={styles.titleHighlight}>AI</span>
          </h1>

          {!submitted ? (
            <>
              <p className={styles.subtitle}>Forgot password?</p>
              <p className={styles.description}>
                Enter your email and we'll send you a reset link
              </p>
            </>
          ) : (
            <>
              <p className={styles.subtitle}>Check your email</p>
              <p className={styles.description}>
                If an account exists for <strong>{email}</strong>, a password reset link
                has been sent. Click the link in the email to set a new password.
              </p>
              <br />
              <p className={styles.descriptionSmall}>
                Didn't receive it? Check your spam folder or{' '}
                <button
                  className={styles.retryLink}
                  onClick={() => { setSubmitted(false); setEmail(''); }}
                >
                  try a different email
                </button>
                .
              </p>
            </>
          )}
        </div>

        {!submitted && (
          <>
            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="admin@lunaxdigital.com"
                  required
                  className={styles.input}
                />
                {emailError && <p className={styles.fieldError}>{emailError}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || !email || !!emailError}
                className={styles.submitButton}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}

        <div className={styles.footer}>
          <Link href="/login" className={styles.link}>
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}