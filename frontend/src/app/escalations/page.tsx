'use client';

/**
 * Persistent queue page showing escalations across the staff
 * member's assigned clinics, with All / Acknowledged / Resolved tabs.
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEscalationNotifications } from '@/contexts/EscalationNotificationContext';
import EscalationCard from '@/components/Notifications/EscalationCard';
import styles from './escalations.module.css';

type EscalationTab = 'all' | 'acknowledged' | 'resolved';

export default function EscalationsPage() {
  const { user } = useAuth();
  const { items, acknowledge, resolve } = useEscalationNotifications();
  const [activeTab, setActiveTab] = useState<EscalationTab>('all');

  const isAdmin = user?.role === 'admin';

  // Derive filtered lists
  const allItems = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const filtered = allItems.filter((e) => {
    if (activeTab === 'acknowledged') return e.acknowledgedByMe && !e.resolvedAt;
    if (activeTab === 'resolved') return !!e.resolvedAt;
    // "all" shows unresolved only (active queue)
    return !e.resolvedAt;
  });

  const tabs: { key: EscalationTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: allItems.filter((e) => !e.resolvedAt).length },
    { key: 'acknowledged', label: 'Acknowledged', count: allItems.filter((e) => e.acknowledgedByMe && !e.resolvedAt).length },
    { key: 'resolved', label: 'Resolved', count: allItems.filter((e) => !!e.resolvedAt).length },
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Escalations</h1>
      <p className={styles.subtitle}>
        Leads the AI couldn&apos;t handle. Call each person on this list as soon as you can.
      </p>

      {isAdmin ? (
        <div className={styles.emptyState}>
          Escalations are handled by staff members assigned to each clinic.
          Sign in with a staff account to view and action escalations.
        </div>
      ) : (
        <>
          <div className={styles.tabBar}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span className={styles.tabCount}>{tab.count}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              {activeTab === 'all' && 'No active escalations right now.'}
              {activeTab === 'acknowledged' && 'No acknowledged escalations.'}
              {activeTab === 'resolved' && 'No resolved escalations.'}
            </div>
          ) : (
            <div className={styles.list}>
              {filtered.map((item) => (
                <EscalationCard
                  key={item.id}
                  item={item}
                  onAcknowledge={acknowledge}
                  onResolve={activeTab !== 'resolved' ? resolve : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
