'use client';

import { useRef, useState } from 'react';
import styles from './ClinicDetailTabs.module.css';
import type { Clinic } from '@/types/clinic';
import ClinicSettingsForm from '@/components/EditClinicsDetails/ClinicSettingsForm';
import { updateClinicSettings } from '@/lib/api/clinics';

/** Available tabs on the clinic detail page. */
const TABS = ['Overview', 'Settings', 'AI Configuration', 'Conversations', 'Analytics'] as const;

type Tab = (typeof TABS)[number];

interface ClinicDetailTabsProps {
  clinic: Clinic;
  onClinicUpdated?: (updated: Clinic) => void;
}

/**
 * Tabbed navigation for the clinic detail page.
 * The Settings tab renders the real ClinicSettingsForm;
 * all other tabs render placeholder content.
 */
export default function ClinicDetailTabs({ clinic, onClinicUpdated }: ClinicDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /** Called by ClinicSettingsForm when the user submits. */
  const handleSaveSettings = async (updated: Clinic) => {
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const saved = await updateClinicSettings(clinic._id, {
        name: updated.name,
        address: updated.address,
        phone: updated.phone,
        ghlLocationId: updated.ghlLocationId,
        serviceAreas: updated.serviceAreas,
        businessHours: updated.businessHours,
      } as Partial<Clinic>);
      setSaveSuccess(true);
      onClinicUpdated?.(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'Settings') {
      return (
        <div>
          {saveSuccess && (
            <p className={styles.successBanner} role="status">Settings saved successfully.</p>
          )}
          {saveError && (
            <p className={styles.errorText} role="alert">{saveError}</p>
          )}
          <ClinicSettingsForm
            ref={formRef}
            clinic={clinic as any}
            onSave={handleSaveSettings as any}
          />
          <div className={styles.saveBar}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => formRef.current?.requestSubmit()}
            >
              Save Settings
            </button>
          </div>
        </div>
      );
    }

    return (
      <p className={styles.placeholder}>
        Clinic {activeTab.toLowerCase()} would go here...
      </p>
    );
  };

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

      {/* Tab content */}
      <div className={styles.tabContent}>
        {renderTabContent()}
      </div>
    </>
  );
}
