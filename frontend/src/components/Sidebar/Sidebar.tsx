'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.css';
import {
  DashboardIcon, ClinicsIcon, ConversationsIcon,
  AnalyticsIcon, SettingsIcon, UserIcon, LogoutIcon, ShieldIcon,
} from '../Icons';

const navItems = [
  { label: 'Dashboard', href: '/', icon: DashboardIcon },
  { label: 'Clinics', href: '/clinics', icon: ClinicsIcon },
  { label: 'Conversations', href: '/conversations', icon: ConversationsIcon },
  { label: 'Analytics', href: '/analytics', icon: AnalyticsIcon },
];

const settingsItem = { label: 'Settings', href: '/settings', icon: SettingsIcon };

/**
 * Fixed sidebar for the dashboard.
 * Staff members see the same nav but are restricted from admin-only pages
 * via route protection in AuthContext.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          AppointHealth <span className={styles.brandAi}>AI</span>
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