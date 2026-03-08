'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.css';
import {
  DashboardIcon,
  ClinicsIcon,
  ConversationsIcon,
  AnalyticsIcon,
  SettingsIcon,
  UserIcon,
  LogoutIcon,
} from '../Icons';

/** Main nav links rendered in the top section of the sidebar. */
const navItems = [
  { label: 'Dashboard', href: '/', icon: DashboardIcon },
  { label: 'Clinics', href: '/clinics', icon: ClinicsIcon },
  { label: 'Conversations', href: '/conversations', icon: ConversationsIcon },
  { label: 'Analytics', href: '/analytics', icon: AnalyticsIcon },
];

// Settings sits outside the main nav group, pinned just above the user section.
const settingsItem = { label: 'Settings', href: '/settings', icon: SettingsIcon };

/**
 * Fixed sidebar used as the primary navigation across the dashboard.
 * Highlights the active route and displays a static user profile at the bottom.
 * Rendered inside RootLayout so it persists across all pages.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  /**
   * Checks whether a nav link should be highlighted.
   * Exact match for the root path, prefix match for everything else.
   */
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
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
          <div className={styles.userName}>Admin User</div>
          <div className={styles.userEmail}>admin@lunaxdigital.com</div>
        </div>
        <button className={styles.logoutButton} aria-label="Logout" 
          onClick={logout}>
          <LogoutIcon className={styles.logoutIcon} />
        </button>
      </div>
    </aside>
  );
}
