'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
const ADMIN_ONLY_ROUTES = ['/settings/users'];

/** BroadcastChannel name used to sync auth events across browser tabs */
const AUTH_CHANNEL = 'appointhealth_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Set up BroadcastChannel to sync logout/login across tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    channelRef.current = new BroadcastChannel(AUTH_CHANNEL);

    channelRef.current.onmessage = (event) => {
      if (event.data === 'logout') {
        // Another tab logged out — clear state and redirect this tab too
        setUser(null);
        router.push('/login');
      }
      if (event.data === 'login') {
        // Another tab logged in — reload user from localStorage
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
        }
      }
    };

    return () => channelRef.current?.close();
  }, [router]);

  // Load user from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Route protection
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
    const isAdminOnly = ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r));

    if (!isPublic && !user) { router.push('/login'); return; }
    if (isPublic && user) { router.push('/'); return; }
    if (isAdminOnly && user?.role !== 'admin') { router.push('/'); }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { user, accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    // Notify other tabs that a login occurred
    channelRef.current?.postMessage('login');
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
    // Notify all other open tabs to log out too
    channelRef.current?.postMessage('logout');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
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