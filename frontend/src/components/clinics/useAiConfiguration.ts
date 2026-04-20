import { useState, useEffect, useCallback } from 'react';
import type { AITone, QualificationQuestion } from '@/types/clinic';
import { fetchAiSettings, saveAiSettings } from '@/lib/ai-settings-api';

interface AiConfigurationState {
  tone: AITone;
  greeting: string;
  questions: QualificationQuestion[];
  instructions: string;
  loading: boolean;
  error: string | null;
  saving: boolean;
  toast: { type: 'success' | 'error'; message: string } | null;
  setTone: (t: AITone) => void;
  setGreeting: (g: string) => void;
  setQuestions: (q: QualificationQuestion[]) => void;
  setInstructions: (i: string) => void;
  handleSave: () => Promise<void>;
}

/**
 * Manages the AI configuration state for a clinic.
 * Fetches settings when the tab becomes active and
 * provides a save handler that persists changes.
 *
 * @param clinicId - The clinic's MongoDB ID
 * @param isActive - Whether the AI Configuration tab is currently visible
 */
export default function useAiConfiguration(clinicId: string, isActive: boolean): AiConfigurationState {
  const [tone, setTone] = useState<AITone>('friendly');
  const [greeting, setGreeting] = useState('');
  const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch settings when the tab becomes active
  useEffect(() => {
    if (!isActive) return;
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
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isActive, clinicId]);

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
      setTimeout(() => setToast(null), 4000);
    }
  }, [clinicId, tone, greeting, questions, instructions]);

  return {
    tone, greeting, questions, instructions,
    loading, error, saving, toast,
    setTone, setGreeting, setQuestions, setInstructions,
    handleSave,
  };
}
