'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/apiAxios';
import styles from './signup.module.css';
import {Eye, EyeOff} from 'lucide-react';

type FieldErrors = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({
    name: "", email: "",
    password: "", confirmPassword: ""
  });

  const [backendErrors, setBackendErrors] = useState('')
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const validateEmail = (email: string) => {
     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  const validatePassword = (pwd: string) => {
     return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(pwd);
  };

  // Real-time validation
  useEffect(() => {
    const newErrors: typeof errors = {
      name: "", email: "",
      password: "", confirmPassword: ""
    };

    if (name && name.trim().length < 3) newErrors.name = 'Name must be at least 3 characters';
    if (email && !validateEmail(email)) newErrors.email = 'Invalid email address';
    if (password && !validatePassword(password)) 
      newErrors.password =
    'Password must be at least 8 characters, include uppercase, lowercase, number and special character';

    if (confirmPassword && confirmPassword !== password)
      newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);

    setIsValid(
      name.trim().length >= 3 &&
      validateEmail(email) &&
      validatePassword(password) &&
      password === confirmPassword
    );
  }, [name, email, password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackendErrors('');
    if (!isValid) return;

    setLoading(true);

    try {
      await api.post('/auth/register', { name, email, password });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setBackendErrors(err.response?.data?.message || 'Registration failed. Please try again.');
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
          <p className={styles.subtitle}>Create your account</p>
          <p className={styles.description}>
            Start managing healthcare appointments with AI
          </p>
        </div>

        {backendErrors && <p className={styles.backendError}>{backendErrors}</p>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          
          {/* Name Field */}
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className={styles.input}
            />
            {errors.name && <p className={styles.error}>{errors.name}</p>}
          </div>

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
              placeholder="john@example.com"
              required
              className={styles.input}
            />
            {errors.email && <p className={styles.error}>{errors.email}</p>}
          </div>
          
          {/* Password Field */}
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}> Password </label>
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.input}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.eyeButton}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {password && (
              <p className={styles.error} > {errors.password} </p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              className={styles.input}
            />
            {errors.confirmPassword && (
              <p className={styles.error}>{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className={styles.footer}>
          Already have an account?{' '}
          <Link href="/login" className={styles.link}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}