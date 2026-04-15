'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/apiAxios';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  assignedClinics?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ['/login', '/forgot-password'];
const TOKEN_ROUTES = ['/verify-email', '/reset-password'];

/** How often to validate the token against the backend (ms) */
const TOKEN_POLL_MS = 60_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Multi-tab logout via storage events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' && e.newValue === null) {
        setUser(null);
        router.push('/login');
      }
      if (e.key === 'user' && e.newValue) {
        try { setUser(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [router]);

  // Route protection
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
    const isTokenRoute = TOKEN_ROUTES.some(r => pathname.startsWith(r));
    if (isTokenRoute) return;
    if (!isPublic && !user) { router.push('/login'); return; }
    if (isPublic && user) { router.push('/'); }
  }, [user, loading, pathname, router]);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  }, [router]);

  /**
   * Polls GET /auth/me every 30 seconds while the user is logged in.
   * If the backend returns a 401 (e.g. because tokenVersion changed after
   * a role update), the axios interceptor fires which clears localStorage
   * and redirects to /login?expired=true — logging the affected user out
   * immediately without them needing to click anything.
   *
   * Only polls when the browser tab is visible to avoid unnecessary requests.
   */
  useEffect(() => {
    if (!user) return;

    const validateToken = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        await api.get('/auth/me');
      } catch {
        // 401 is handled by the axios interceptor in apiAxios.ts
        // which clears localStorage and redirects to /login?expired=true
      }
    };

    const interval = setInterval(validateToken, TOKEN_POLL_MS);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { user, accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}