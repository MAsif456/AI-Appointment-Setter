'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { fetchAiSettings, saveAiSettings } from '@/lib/ai-settings-api';
import ToneSelector from '@/components/AIConfiguration/ToneSelector';
import GreetingMessage from '@/components/AIConfiguration/GreetingMessage';
import QualificationQuestions from '@/components/AIConfiguration/QualificationQuestions';
import CustomInstructions from '@/components/AIConfiguration/CustomInstructions';
import SaveBar from '@/components/AIConfiguration/SaveBar';
import { AITone, QualificationQuestion } from '@/types/clinic';

/**
 * AI Configuration page for a specific clinic.
 * Fetches settings from the backend API on mount and persists
 * changes via PUT when the user clicks Save.
 */
export default function AIConfigurationPage() {
  const params = useParams();
  const clinicId = params.id as string;

  // Form state
  const [tone, setTone] = useState<AITone>('friendly');
  const [greeting, setGreeting] = useState('');
  const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
  const [instructions, setInstructions] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch AI settings from the backend on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAiSettings(clinicId)
      .then((data) => {
        if (cancelled) return;
        setTone(data.tone);
        setGreeting(data.greetingTemplate);
        setQuestions(data.qualificationQuestions);
        setInstructions(data.customInstructions);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clinicId]);

  /** Saves all current settings to the backend. */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setToast(null);
    try {
      await saveAiSettings(clinicId, {
        tone,
        greetingTemplate: greeting,
        qualificationQuestions: questions,
        customInstructions: instructions,
      });
      setToast({ type: 'success', message: 'Settings saved successfully' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
      // Auto-dismiss toast after 4 seconds
      setTimeout(() => setToast(null), 4000);
    }
  }, [clinicId, tone, greeting, questions, instructions]);

  if (loading) {
    return <p style={{ padding: '24px', color: '#6b7280' }}>Loading AI settings...</p>;
  }

  if (error) {
    return <p style={{ padding: '24px', color: '#dc2626' }}>Error: {error}</p>;
  }

  return (
    <div>
      <ToneSelector value={tone} onChange={setTone} />
      <GreetingMessage value={greeting} onChange={setGreeting} />
      <QualificationQuestions questions={questions} onChange={setQuestions} />
      <CustomInstructions value={instructions} onChange={setInstructions} />
      <SaveBar onSave={handleSave} saving={saving} toast={toast} />
    </div>
  );
}
