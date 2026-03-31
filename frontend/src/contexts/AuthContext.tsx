'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

const PUBLIC_ROUTES = ['/login', '/verify-email', '/forgot-password', '/reset-password'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load user on mount
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

  /**
   * Listens for localStorage changes made in OTHER browser tabs.
   * When accessToken is removed (logout) in another tab, this tab
   * clears state and redirects to login automatically.
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' && e.newValue === null) {
        // Another tab logged out — sync this tab
        setUser(null);
        router.push('/login');
      }
      if (e.key === 'user' && e.newValue) {
        // Another tab updated the user (e.g. after role change)
        try {
          setUser(JSON.parse(e.newValue));
        } catch { /* ignore */ }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [router]);

  // Route protection
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

    if (!isPublic && !user) {
      router.push('/login');
      return;
    }
    if (isPublic && user) {
      router.push('/');
      return;
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { user, accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    router.push('/');
  };

  const logout = () => {
    // Removing accessToken triggers the storage event in other open tabs
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
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