'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './ClinicDetailTabs.module.css';

/** Props for the tab navigation component. */
interface ClinicDetailTabsProps {
  clinicId: string;
}

/** Tab definitions with label and sub-path. */
const tabs = [
  { label: 'Overview', path: '' },
  { label: 'Settings', path: '/settings' },
  { label: 'AI Configuration', path: '/ai-configuration' },
  { label: 'Conversations', path: '/conversations' },
  { label: 'Analytics', path: '/analytics' },
];

/**
 * Horizontal tab navigation for the clinic detail view.
 * Highlights the currently active tab based on the URL path.
 */
export default function ClinicDetailTabs({ clinicId }: ClinicDetailTabsProps) {
  const pathname = usePathname();
  const basePath = `/clinics/${clinicId}`;

  /**
   * Determines whether a tab is active by comparing its full
   * path against the current route.
   */
  const isActive = (tabPath: string) => {
    const fullPath = basePath + tabPath;
    // Exact match for the base path (Overview tab)
    if (tabPath === '') return pathname === basePath;
    return pathname.startsWith(fullPath);
  };

  return (
    <nav className={styles.tabs}>
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={`${basePath}${tab.path}`}
          className={`${styles.tab} ${isActive(tab.path) ? styles.tabActive : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
