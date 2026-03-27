'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AccountSettings from './components/AccountSettings';
import UserManagement from './components/UserManagement';
import styles from './settings.module.css';

type Tab = 'account' | 'users' | 'notifications' | 'integrations';

/**
 * Settings page — renders tab navigation and delegates to
 * the appropriate tab component. Admin users see all tabs,
 * staff users only see Account Settings.
 */
export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('account');

  const tabs = [
    { key: 'account' as Tab, label: 'Account Settings' },
    ...(isAdmin ? [
      { key: 'users' as Tab, label: 'User Management' },
      { key: 'notifications' as Tab, label: 'Notifications' },
      { key: 'integrations' as Tab, label: 'Integrations' },
    ] : []),
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'account' && <AccountSettings />}
        {activeTab === 'users' && isAdmin && <UserManagement />}
        {activeTab === 'notifications' && <PlaceholderTab title="Notifications" />}
        {activeTab === 'integrations' && <PlaceholderTab title="Integrations" />}
      </div>
    </div>
  );
}

/** Stub for tabs not yet implemented */
function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionDesc}>Coming soon.</p>
    </div>
  );
}