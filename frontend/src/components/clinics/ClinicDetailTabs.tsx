'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './ClinicDetailTabs.module.css';
import type { Clinic, AITone, QualificationQuestion } from '@/types/clinic';
import ClinicSettingsForm from '@/components/EditClinicsDetails/ClinicSettingsForm';
import { updateClinicSettings } from '@/lib/api/clinics';
import { fetchAiSettings, saveAiSettings } from '@/lib/ai-settings-api';
import ToneSelector from '@/components/AIConfiguration/ToneSelector';
import GreetingMessage from '@/components/AIConfiguration/GreetingMessage';
import QualificationQuestions from '@/components/AIConfiguration/QualificationQuestions';
import CustomInstructions from '@/components/AIConfiguration/CustomInstructions';
import SaveBar from '@/components/AIConfiguration/SaveBar';

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

  // AI Configuration state
  const [tone, setTone] = useState<AITone>('friendly');
  const [greeting, setGreeting] = useState('');
  const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
  const [instructions, setInstructions] = useState('');
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiToast, setAiToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch AI settings when the AI Configuration tab is first activated
  useEffect(() => {
    if (activeTab !== 'AI Configuration') return;

    let cancelled = false;
    setAiLoading(true);
    setAiError(null);

    fetchAiSettings(clinic._id)
      .then((data) => {
        if (cancelled) return;
        setTone(data.tone);
        setGreeting(data.greetingTemplate);
        setQuestions(data.qualificationQuestions);
        setInstructions(data.customInstructions);
      })
      .catch((err) => {
        if (!cancelled) setAiError(err.message);
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, clinic._id]);

  /** Saves AI settings to the backend. */
  const handleAiSave = useCallback(async () => {
    setAiSaving(true);
    setAiToast(null);
    try {
      await saveAiSettings(clinic._id, {
        tone,
        greetingTemplate: greeting,
        qualificationQuestions: questions,
        customInstructions: instructions,
      });
      setAiToast({ type: 'success', message: 'Settings saved successfully' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setAiToast({ type: 'error', message: msg });
    } finally {
      setAiSaving(false);
      setTimeout(() => setAiToast(null), 4000);
    }
  }, [clinic._id, tone, greeting, questions, instructions]);

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

    if (activeTab === 'AI Configuration') {
      if (aiLoading) {
        return <p style={{ padding: '24px', color: '#6b7280' }}>Loading AI settings...</p>;
      }
      if (aiError) {
        return <p style={{ padding: '24px', color: '#dc2626' }}>Error: {aiError}</p>;
      }
      return (
        <div>
          <ToneSelector value={tone} onChange={setTone} />
          <GreetingMessage value={greeting} onChange={setGreeting} />
          <QualificationQuestions questions={questions} onChange={setQuestions} />
          <CustomInstructions value={instructions} onChange={setInstructions} />
          <SaveBar onSave={handleAiSave} saving={aiSaving} toast={aiToast} />
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
