'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/Notifications/NotificationBell';
import { fetchUnreadCount } from '@/lib/api/notifications';
import styles from './Sidebar.module.css';
import {
  DashboardIcon, ClinicsIcon, ConversationsIcon,
  AnalyticsIcon, SettingsIcon, UserIcon, LogoutIcon, ShieldIcon,
} from '../Icons';

const baseNavItems = [
  { label: 'Dashboard', href: '/', icon: DashboardIcon },
  { label: 'Clinics', href: '/clinics', icon: ClinicsIcon },
  { label: 'Conversations', href: '/conversations', icon: ConversationsIcon },
  { label: 'Analytics', href: '/analytics', icon: AnalyticsIcon },
];

const escalationItem = { label: 'Escalations', href: '/escalations', icon: ConversationsIcon };
const settingsItem = { label: 'Settings', href: '/settings', icon: SettingsIcon };

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/**
 * Fixed sidebar for the dashboard.
 * Includes an Inbox nav item (between Analytics and Settings) with an
 * unread-count badge that polls every 30 seconds.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll unread count every 30 seconds; stop when component unmounts.
  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetchUnreadCount().then((c) => { if (active) setUnreadCount(c); });
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const isStaff = user?.role === 'staff';
  const navItems = isStaff
    ? [...baseNavItems.slice(0, 3), escalationItem, ...baseNavItems.slice(3)]
    : baseNavItems;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <aside className={styles.sidebar}>
        <div
          className={styles.brand}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>
            AppointHealth <span className={styles.brandAi}>AI</span>
          </span>
          <NotificationBell />
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
            >
              <item.icon className={styles.navIcon} />
              {item.label}
            </Link>
          ))}

          {isAdmin && (
            <Link
              href="/data-protection"
              className={`${styles.navLink} ${isActive('/data-protection') ? styles.navLinkActive : ''}`}
            >
              <ShieldIcon className={styles.navIcon} />
              Data Protection
            </Link>
          )}

          {/* Inbox — visible to all authenticated users, above Settings */}
          <Link
            href="/notifications"
            className={`${styles.navLink} ${isActive('/notifications') ? styles.navLinkActive : ''}`}
            style={{ position: 'relative' }}
          >
            <InboxIcon className={styles.navIcon} />
            Inbox
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '9999px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  minWidth: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </nav>

        <Link
          href={settingsItem.href}
          className={`${styles.navLink} ${isActive(settingsItem.href) ? styles.navLinkActive : ''}`}
        >
          <SettingsIcon className={styles.navIcon} />
          {settingsItem.label}
        </Link>

        <div className={styles.userSection}>
          <div className={styles.avatar}>
            <UserIcon className={styles.avatarIcon} />
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user?.name || 'User'}</div>
            <div className={styles.userRole}>{user?.role === 'admin' ? 'Admin' : 'Staff'}</div>
          </div>
          <button
            className={styles.logoutButton}
            aria-label="Logout"
            onClick={() => setShowLogout(true)}
          >
            <LogoutIcon className={styles.logoutIcon} />
          </button>
        </div>
      </aside>

      {showLogout && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className={styles.modalButtons}>
              <button className={styles.cancelButton} onClick={() => setShowLogout(false)}>
                Cancel
              </button>
              <button className={styles.confirmButton} onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}