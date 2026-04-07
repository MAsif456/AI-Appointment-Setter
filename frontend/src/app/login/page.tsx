'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './login.module.css';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [success, setSuccess] = useState('');

  // Check for session expiration message
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setError('Your session has expired. Please log in again.');
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  // Check for email verification and password reset messages
  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setSuccess('Email verified successfully. You can now log in.');
    }
    if (searchParams.get('reset') === 'true') {
      setSuccess('Password reset successfully. Please log in.');
    }
  }, [searchParams]);

  const validateEmail = (value: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
      setSuccess('');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Apply error border class when there is a login error.
   * The error border is shown on both inputs when the login attempt fails,
   * matching the red border style used on the Add Clinic form.
   */
  const inputErrorClass = error ? styles.inputError : '';

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            AppointHealth <span className={styles.titleHighlight}>AI</span>
          </h1>
          <p className={styles.subtitle}>Welcome back</p>
          <p className={styles.description}>Sign in to manage your clinic clients</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Email Field */}
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                const value = e.target.value;
                setEmail(value);
                validateEmail(value);
                setError('');
                setSuccess('');
              }}
              placeholder=" "
              required
              className={`${styles.input} ${inputErrorClass}`}
            />
            {emailError && <p className={styles.fieldError}>{emailError}</p>}
          </div>

          {/* Password Field */}
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <div className={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`${styles.input} ${inputErrorClass}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.eyeButton}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!emailError || !email || !password}
            className={styles.submitButton}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className={styles.forgotPassword}>
          <Link href="/forgot-password" className={styles.forgotPasswordLink}>
            Forgot Password?
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
