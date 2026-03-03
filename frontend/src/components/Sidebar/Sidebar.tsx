'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

const navItems = [
  { label: 'Dashboard', href: '/', icon: DashboardIcon },
  { label: 'Clinics', href: '/clinics', icon: ClinicsIcon },
  { label: 'Conversations', href: '/conversations', icon: ConversationsIcon },
  { label: 'Analytics', href: '/analytics', icon: AnalyticsIcon },
];

const settingsItem = { label: 'Settings', href: '/settings', icon: SettingsIcon };


export default function Sidebar() {
  const pathname = usePathname();

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
        <button className={styles.logoutButton} aria-label="Logout">
          <LogoutIcon className={styles.logoutIcon} />
        </button>
      </div>
    </aside>
  );
}
