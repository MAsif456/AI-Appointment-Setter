'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import styles from './ClinicDetailTabs.module.css';
import type { Clinic, AITone, QualificationQuestion } from '@/types/clinic';
import { updateClinicSettings } from '@/lib/api/clinics';
import { fetchAiSettings, saveAiSettings } from '@/lib/ai-settings-api';
import ToneSelector from '@/components/AIConfiguration/ToneSelector';
import GreetingMessage from '@/components/AIConfiguration/GreetingMessage';
// QualificationQuestions hidden per AC-1 — import retained for potential future use
// import QualificationQuestions from '@/components/AIConfiguration/QualificationQuestions';
import CustomInstructions from '@/components/AIConfiguration/CustomInstructions';
import SaveBar from '@/components/AIConfiguration/SaveBar';
import ClinicSettingsForm, { type ClinicSettingsFormHandle } from '@/components/EditClinicsDetails/ClinicSettingsForm';
import ClinicSettingsView from '@/components/EditClinicsDetails/ClinicSettingsView';
import ClinicAnalyticsTab from '@/components/Analytics/ClinicAnalyticsTab';
import ClinicOverviewTab from './ClinicOverviewTab';
import RecentConversations, { type RecentConversation } from '@/components/dashboard/RecentConversations';
import { fetchRecentConversations } from '@/lib/api/dashboard';

/** Available tabs on the clinic detail page. */
const TABS = ['Overview', 'Settings', 'AI Configuration', 'Conversations', 'Analytics'] as const;

type Tab = (typeof TABS)[number];

interface ClinicDetailTabsProps {
  clinic: Clinic;
  onClinicUpdated?: (updated: Clinic) => void;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onTabChange?: (tab: string) => void;
}

export type ClinicDetailTabsHandle = {
  submitForm: () => void;
};

const ClinicDetailTabs = forwardRef<ClinicDetailTabsHandle, ClinicDetailTabsProps>(
  function ClinicDetailTabs({ clinic, onClinicUpdated, isEditing = false, onEditingChange, onTabChange }, ref) {
  const formRef = useRef<ClinicSettingsFormHandle>(null);
  useImperativeHandle(ref, () => ({ submitForm: () => formRef.current?.submit() }));

  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // When edit mode is triggered from the parent, switch to the Settings tab
  useEffect(() => {
    if (isEditing) setActiveTab('Settings');
  }, [isEditing]);

  // AI Configuration state
  const [tone, setTone] = useState<AITone>('friendly');
  const [greeting, setGreeting] = useState('');
  const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
  const [instructions, setInstructions] = useState('');
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiToast, setAiToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      .catch((err) => { if (!cancelled) setAiError(err.message); })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, clinic._id]);

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

  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Conversations tab state
  const [clinicConvos, setClinicConvos] = useState<RecentConversation[]>([]);
  const [convosLoading, setConvosLoading] = useState(true);

  useEffect(() => {
    if (activeTab !== 'Conversations') return;
    let cancelled = false;
    setConvosLoading(true);
    fetchRecentConversations(50, clinic._id)
      .then((data) => { if (!cancelled) setClinicConvos(data); })
      .catch(() => { if (!cancelled) setClinicConvos([]); })
      .finally(() => { if (!cancelled) setConvosLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, clinic._id]);

  const handleSaveSettings = async (updated: Partial<Clinic>) => {
    try {
      const saved = await updateClinicSettings(clinic._id, updated);
      setSettingsError(null);
      setSaveSuccess(true);
      onClinicUpdated?.(saved);
      onEditingChange?.(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const tabBar = (
    <div className={styles.tabBar}>
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => { setActiveTab(tab); onEditingChange?.(false); onTabChange?.(tab); }}
          className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  // Edit mode: render the form outside the card so it gets full width and no interference
  if (activeTab === 'Settings' && isEditing) {
    return (
      <>
        {tabBar}
        <div className={styles.editFormWrapper}>
          {settingsError && (
            <p role="alert" className={styles.errorText}>{settingsError}</p>
          )}
          <ClinicSettingsForm
            ref={formRef}
            clinic={clinic}
            onSave={handleSaveSettings}
            onCancel={() => onEditingChange?.(false)}
          />
          <div className={styles.formFooterActions}>
            <button
              className={styles.formCancelButton}
              onClick={() => onEditingChange?.(false)}
            >
              Cancel
            </button>
            <button
              className={styles.formSaveButton}
              onClick={() => formRef.current?.submit()}
            >
              Save Settings
            </button>
          </div>
        </div>
      </>
    );
  }

  const renderTabContent = () => {
    if (activeTab === 'Settings') {
      return (
        <ClinicSettingsView
          clinic={clinic}
          onEdit={() => onEditingChange?.(true)}
          saveSuccess={saveSuccess}
        />
      );
    }

    if (activeTab === 'AI Configuration') {
      if (aiLoading) {
        return <p style={{ color: 'var(--text-muted)' }}>Loading AI settings...</p>;
      }
      if (aiError) {
        return <p style={{ color: 'var(--color-error)' }}>Error: {aiError}</p>;
      }
      return (
        <div>
          <ToneSelector value={tone} onChange={setTone} />
          <GreetingMessage value={greeting} onChange={setGreeting} />
          {/* Qualification questions hidden per AC-1 — section not visible on AI config page */}
          <CustomInstructions value={instructions} onChange={setInstructions} />
          <SaveBar onSave={handleAiSave} saving={aiSaving} toast={aiToast} />
        </div>
      );
    }

    if (activeTab === 'Analytics') {
      return <ClinicAnalyticsTab clinicId={clinic._id} />;
    }

    if (activeTab === 'Conversations') {
      if (convosLoading) {
        return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Loading conversations...</p>;
      }
      return (
        <RecentConversations
          conversations={clinicConvos}
          title="Conversations"
          hideViewAll
          hideClinic
        />
      );
    }

    if (activeTab === 'Overview') {
      return <ClinicOverviewTab clinic={clinic} />;
    }

    return null;
  };

  return (
    <>
      {tabBar}
      <div className={styles.tabContent}>
        {renderTabContent()}
      </div>
    </>
  );
});

export default ClinicDetailTabs;
