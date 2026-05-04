'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import styles from './ClinicDetailTabs.module.css';
import type { Clinic } from '@/types/clinic';
import { updateClinicSettings, getClinicById } from '@/lib/api/clinics';
import ToneSelector from '@/components/AIConfiguration/ToneSelector';
import GreetingMessage from '@/components/AIConfiguration/GreetingMessage';
import CustomInstructions from '@/components/AIConfiguration/CustomInstructions';
import SaveBar from '@/components/AIConfiguration/SaveBar';
import ClinicSettingsForm, { type ClinicSettingsFormHandle } from '@/components/EditClinicsDetails/ClinicSettingsForm';
import ClinicSettingsView from '@/components/EditClinicsDetails/ClinicSettingsView';
import ClinicIntegrationsPage from '@/app/clinics/[id]/integrations/page';
import ClinicAnalyticsTab from '@/components/Analytics/ClinicAnalyticsTab';
import ClinicOverviewTab from './ClinicOverviewTab';
import RecentConversations, { type RecentConversation } from '@/components/dashboard/RecentConversations';
import { fetchRecentConversations } from '@/lib/api/dashboard';
import useAiConfiguration from './useAiConfiguration';

/** Available tabs on the clinic detail page. */
const TABS = ['Overview', 'Settings', 'AI Configuration', 'Integrations', 'Conversations', 'Analytics'] as const;
type Tab = (typeof TABS)[number];

interface ClinicDetailTabsProps {
  clinic: Clinic;
  onClinicUpdated?: (updated: Clinic) => void;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onTabChange?: (tab: string) => void;
}

export type ClinicDetailTabsHandle = { submitForm: () => void };

/**
 * Tabbed container for all clinic detail views: Overview, Settings,
 * AI Configuration, Integrations, Conversations, and Analytics.
 */
const ClinicDetailTabs = forwardRef<ClinicDetailTabsHandle, ClinicDetailTabsProps>(
  function ClinicDetailTabs({ clinic, onClinicUpdated, isEditing = false, onEditingChange, onTabChange }, ref) {
    const formRef = useRef<ClinicSettingsFormHandle>(null);
    useImperativeHandle(ref, () => ({ submitForm: () => formRef.current?.submit() }));

    const [activeTab, setActiveTab] = useState<Tab>('Overview');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    // Switch to Settings tab when edit mode is triggered externally
    useEffect(() => { if (isEditing) setActiveTab('Settings'); }, [isEditing]);

    // AI Configuration hook
    const ai = useAiConfiguration(clinic._id, activeTab === 'AI Configuration');

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

    /** Persist settings edits via the API. */
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

    // Edit mode renders the form at full width
    if (activeTab === 'Settings' && isEditing) {
      return (
        <>
          {tabBar}
          <div className={styles.editFormWrapper}>
            {settingsError && <p role="alert" className={styles.errorText}>{settingsError}</p>}
            <ClinicSettingsForm
              ref={formRef}
              clinic={clinic}
              onSave={handleSaveSettings}
              onCancel={() => onEditingChange?.(false)}
            />
            <div className={styles.formFooterActions}>
              <button className={styles.formCancelButton} onClick={() => onEditingChange?.(false)}>Cancel</button>
              <button className={styles.formSaveButton} onClick={() => formRef.current?.submit()}>Save Settings</button>
            </div>
          </div>
        </>
      );
    }

    /** Renders the active tab's content. */
    const renderTabContent = () => {
      switch (activeTab) {
        case 'Overview':
          return <ClinicOverviewTab clinic={clinic} />;
        case 'Settings':
          return <ClinicSettingsView clinic={clinic} onEdit={() => onEditingChange?.(true)} saveSuccess={saveSuccess} />;
        case 'AI Configuration':
          if (ai.loading) return <p style={{ color: 'var(--text-muted)' }}>Loading AI settings...</p>;
          if (ai.error) return <p style={{ color: 'var(--color-error)' }}>Error: {ai.error}</p>;
          return (
            <div>
              <ToneSelector value={ai.tone} onChange={ai.setTone} />
              <GreetingMessage value={ai.greeting} onChange={ai.setGreeting} />
              <CustomInstructions value={ai.instructions} onChange={ai.setInstructions} />
              <SaveBar onSave={ai.handleSave} saving={ai.saving} toast={ai.toast} />
            </div>
          );
        case 'Integrations':
          return (
            <ClinicIntegrationsPage
              clinicId={clinic._id}
              initialMaskedKey={clinic.ghlApiKey ?? ''}
              initialWebhookUrl={clinic.webhookUrl ?? ''}
              onUpdated={async () => { const refreshed = await getClinicById(clinic._id); onClinicUpdated?.(refreshed); }}
            />
          );
        case 'Conversations':
          if (convosLoading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Loading conversations...</p>;
          return <RecentConversations conversations={clinicConvos} title="Conversations" hideViewAll hideClinic />;
        case 'Analytics':
          return <ClinicAnalyticsTab clinicId={clinic._id} />;
        default:
          return null;
      }
    };

    return (
      <>
        {tabBar}
        <div className={styles.tabContent}>{renderTabContent()}</div>
      </>
    );
  },
);

export default ClinicDetailTabs;
