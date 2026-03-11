'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './login.module.css';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
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
      setError('Please log in again with your email and password.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Redirect is handled by AuthContext
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            AppointHealth <span className={styles.titleHighlight}>AI</span>
          </h1>
          <p className={styles.subtitle}>Welcome back</p>
          <p className={styles.description}>
            Sign in to manage your clinic clients
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}
        
        {/* Success Message */}
        {success && (
          <div className={styles.success}>
            {success}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Email Field */}
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
              required
              className={styles.input}
            />
          </div>
          {/* Password Field */}
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={styles.input}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.showPasswordButton}
                  >
                {showPassword ? "Hide" : "Show"}
                </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Forgot Password Link */}
        <div className={styles.forgotPassword}>
          <Link href="/forgot-password" className={styles.forgotPasswordLink}>
            Forgot Password?
          </Link>
        </div>

        {/* Sign Up Link */}
        <div className={styles.signUp}>
          <Link href="/signup" className={styles.signUpLink}>
            Sign Up
          </Link>
        </div>

        {/* Demo Credentials */}
        <div className={styles.demoBox}>
          <p className={styles.demoTitle}>Demo credentials:</p>
          <p className={styles.demoText}>
            <strong>Email:</strong> admin@lunaxdigital.com
          </p>
          <p className={styles.demoText}>
            <strong>Password:</strong> admin123
          </p>
        </div>
      </div>
    </div>
  );
}