'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AccountSettings from './components/AccountSettings';
import UserManagement from './components/UserManagement';
import IntegrationsSettings from './components/IntegrationsSettings';
import NotificationPreferences from './components/NotificationPreferences';
import styles from './settings.module.css';
import { User, Users, Bell, Plug } from 'lucide-react';

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
    { key: 'account' as Tab, label: 'Account Settings', icon: User },
    ...(isAdmin ? [
      { key: 'users' as Tab, label: 'User Management', icon: Users },
    ] : []),
    { key: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { key: 'integrations' as Tab, label: 'Integrations', icon: Plug },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <div className={styles.tabs}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} className={styles.tabIcon} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={styles.content}>
        {activeTab === 'account' && <AccountSettings />}
        {activeTab === 'users' && isAdmin && <UserManagement />}
        {activeTab === 'notifications' && <NotificationPreferences />}
        {activeTab === 'integrations' && <IntegrationsSettings />}
      </div>
      <br />
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