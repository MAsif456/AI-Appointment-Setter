'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { updateClinicIntegration, testClinicIntegration, disconnectClinicIntegration, getClinicById } from '@/lib/api/clinics';
import ApiScopesList from './ApiScopesList';
import DisconnectConfirmModal from './DisconnectConfirmModal';
import styles from './integrations.module.css';

interface Props {
  clinicId?: string;
  initialMaskedKey?: string;
  initialWebhookUrl?: string;
  onUpdated?: () => void;
}

type ConnectionStatus = 'idle' | 'connected' | 'disconnected' | 'testing';

export default function ClinicIntegrationsPage({
  clinicId: propClinicId,
  initialMaskedKey = '',
  initialWebhookUrl = '',
  onUpdated,
}: Props) {
  const params = useParams<{ id: string }>();
  const id = propClinicId ?? params?.id ?? '';

  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [maskedKey, setMaskedKey] = useState(initialMaskedKey);
  const [status, setStatus] = useState<ConnectionStatus>(initialMaskedKey ? 'connected' : 'disconnected');
  const [loaded, setLoaded] = useState(!!initialMaskedKey);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setMaskedKey(initialMaskedKey);
    setWebhookUrl(initialWebhookUrl);
    setStatus(initialMaskedKey ? 'connected' : 'disconnected');
    setLoaded(true);
  }, [initialMaskedKey, initialWebhookUrl]);

  useEffect(() => {
    if (initialMaskedKey || !id) return;
    getClinicById(id)
      .then((clinic) => {
        if (clinic.ghlApiKey) { setMaskedKey(clinic.ghlApiKey); setStatus('connected'); }
        if (clinic.webhookUrl) setWebhookUrl(clinic.webhookUrl);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [id, initialMaskedKey]);

  function showToastMessage(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), type === 'error' ? 15000 : 7000);
  }

  async function handleSave() {
    if (!apiKey.trim()) { showToastMessage('error', 'Please enter an API key'); return; }
    setSaving(true);
    try {
      await updateClinicIntegration(id, apiKey.trim(), webhookUrl.trim() || undefined);
      const updated = await getClinicById(id);
      setMaskedKey(updated.ghlApiKey ?? '••••••••••••' + apiKey.slice(-6));
      setWebhookUrl(updated.webhookUrl ?? '');
      setApiKey('');
      setStatus('connected');
      showToastMessage('success', 'Integration saved');
      onUpdated?.();
    } catch (err) {
      showToastMessage('error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setStatus('testing');
    try {
      const result = await testClinicIntegration(id);
      setStatus(result.connected ? 'connected' : 'disconnected');
      showToastMessage(
        result.connected ? 'success' : 'error',
        result.connected ? 'Connection successful' : 'Connection failed — check your API key',
      );
    } catch {
      setStatus('disconnected');
      showToastMessage('error', 'Could not reach the server');
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectClinicIntegration(id);
      setMaskedKey(''); setWebhookUrl(''); setApiKey('');
      setStatus('disconnected'); setConfirmOpen(false);
      showToastMessage('success', 'Integration disconnected');
      onUpdated?.();
    } catch {
      setConfirmOpen(false);
      showToastMessage('error', 'Failed to disconnect');
    }
  }

  const dotClass =
    status === 'connected' ? styles.dotConnected :
    status === 'testing'   ? styles.dotTesting :
                             styles.dotDisconnected;
  const label =
    status === 'connected' ? 'Connected' :
    status === 'testing'   ? 'Testing…' :
                             'Not connected';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>GoHighLevel Integration</h2>
        <p className={styles.desc}>Connect this clinic to GoHighLevel to enable AI-powered booking and messaging.</p>
      </div>

      <div className={styles.statusRow}>
        {loaded ? (
          <>
            <span className={`${styles.statusDot} ${dotClass}`} />
            <span className={styles.statusLabel}>{label}</span>
            {maskedKey && <span className={styles.maskedKey}>{maskedKey}</span>}
          </>
        ) : (
          <span className={styles.loadingText}>Loading…</span>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>GHL API Key</label>
        <input
          type="password" className={styles.input} value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={maskedKey ? 'Enter new key to replace' : 'Enter GHL private integration token'}
        />
        <p className={styles.fieldHint}>Settings → Private Integrations in your GHL sub-account.</p>
        <ApiScopesList />
      </div>

      <div className={styles.formGroupLast}>
        <label className={styles.label}>
          Webhook URL <span className={styles.labelOptional}>(optional)</span>
        </label>
        <input
          type="url" className={styles.input} value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-domain.com/webhooks/ghl"
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {maskedKey && (
          <>
            <button className={styles.btnOutline} onClick={handleTest} disabled={status === 'testing'}>
              Test Connection
            </button>
            <button className={styles.btnDanger} onClick={() => setConfirmOpen(true)}>Disconnect</button>
          </>
        )}
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          <span className={styles.toastIcon}>{toast.type === 'success' ? '✓' : '!'}</span>
          <span style={{ whiteSpace: 'pre-wrap' }}>{toast.message}</span>
        </div>
      )}

      {confirmOpen && <DisconnectConfirmModal onConfirm={handleDisconnect} onCancel={() => setConfirmOpen(false)} />}
    </div>
  );
}
