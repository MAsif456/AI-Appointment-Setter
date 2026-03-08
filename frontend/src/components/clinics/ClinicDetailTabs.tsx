'use client';

import { useState } from 'react';
import styles from './ClinicDetailTabs.module.css';

/** Available tabs on the clinic detail page. */
const TABS = ['Overview', 'Settings', 'AI Configuration', 'Conversations', 'Analytics'] as const;

type Tab = (typeof TABS)[number];

/**
 * Tabbed navigation for the clinic detail page.
 * Each tab renders placeholder content for now.
 */
export default function ClinicDetailTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  return (
    <>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content – placeholder for each section */}
      <div className={styles.tabContent}>
        <p className={styles.placeholder}>
          Clinic {activeTab.toLowerCase()} would go here...
        </p>
      </div>
    </>
  );
}
