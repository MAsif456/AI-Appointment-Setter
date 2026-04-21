'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/apiAxios';
// Shares the same CSS module as the per-clinic integrations page so both
// pages are visually identical.
import styles from '../../clinics/[id]/integrations/integrations.module.css';

type ConnectionStatus = 'connected' | 'disconnected' | 'testing';

/**
 * Integrations tab (admin only) — manages the global GoHighLevel API key
 * and webhook URL. Identical layout to the per-clinic integrations page.
 */
export default function IntegrationsSettings() {
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 7000);
  }

  async function load() {
    try {
      const { data } = await api.get('/api/integrations');
      setMaskedKey(data.ghlApiKey ?? '');
      setWebhookUrl(data.webhookUrl ?? '');
      setStatus(data.ghlConnectionStatus === 'connected' ? 'connected' : 'disconnected');
    } catch {
      showToast('error', 'Failed to load integration settings. Please refresh the page.');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!apiKey.trim()) { showToast('error', 'Please enter an API key'); return; }
    setSaving(true);
    try {
      const body: Record<string, string> = { ghlApiKey: apiKey.trim() };
      if (webhookUrl.trim()) body.webhookUrl = webhookUrl.trim();
      const { data } = await api.put('/api/integrations', body);
      setMaskedKey(data.ghlApiKey ?? '');
      setWebhookUrl(data.webhookUrl ?? '');
      setStatus(data.ghlConnectionStatus === 'connected' ? 'connected' : 'disconnected');
      setApiKey('');
      showToast('success', 'Integration saved');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setStatus('testing');
    try {
      const { data } = await api.post('/api/integrations/test-connection');
      setStatus(data.connected ? 'connected' : 'disconnected');
      showToast(
        data.connected ? 'success' : 'error',
        data.connected ? 'Connection successful' : 'Connection failed — check your API key',
      );
    } catch {
      setStatus('disconnected');
      showToast('error', 'Could not reach the server');
    }
  }

  async function handleDisconnect() {
    try {
      await api.post('/api/integrations/disconnect');
      setMaskedKey('');
      setWebhookUrl('');
      setApiKey('');
      setStatus('disconnected');
      setConfirmOpen(false);
      showToast('success', 'Integration disconnected');
    } catch {
      setConfirmOpen(false);
      showToast('error', 'Failed to disconnect');
    }
  }

  const dotClass =
    status === 'connected' ? styles.dotConnected :
    status === 'testing'   ? styles.dotTesting :
                             styles.dotDisconnected;
  const statusLabel =
    status === 'connected' ? 'Connected' :
    status === 'testing'   ? 'Testing…' :
                             'Not connected';

  return (
    <div className={styles.container}>

      <div className={styles.header}>
        <h2 className={styles.title}>GoHighLevel Integration</h2>
        <p className={styles.desc}>
          Manage the global API credentials and webhook URL powering the AI booking system.
        </p>
      </div>

      <div className={styles.statusRow}>
        {loaded ? (
          <>
            <span className={`${styles.statusDot} ${dotClass}`} />
            <span className={styles.statusLabel}>{statusLabel}</span>
            {maskedKey && <span className={styles.maskedKey}>{maskedKey}</span>}
          </>
        ) : (
          <span className={styles.loadingText}>Loading…</span>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>GHL Private Integration Token</label>
        <input
          type="password"
          className={styles.input}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={maskedKey ? 'Enter new token to replace current' : 'Enter your GHL Private Integration Token'}
          autoComplete="off"
        />
        <p className={styles.fieldHint}>Settings → Private Integrations in your GHL sub-account.</p>
      </div>

      <div className={styles.formGroupLast}>
        <label className={styles.label}>
          Webhook URL <span className={styles.labelOptional}>(optional)</span>
        </label>
        <input
          type="url"
          className={styles.input}
          value={webhookUrl}
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
            <button
              className={styles.btnOutline}
              onClick={handleTest}
              disabled={status === 'testing'}
            >
              {status === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>
            <button className={styles.btnDanger} onClick={() => setConfirmOpen(true)}>
              Disconnect
            </button>
          </>
        )}
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          <span className={styles.toastIcon}>{toast.type === 'success' ? '✓' : '!'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Calendly placeholder */}
      <div className={styles.divider}>
        <h3 className={styles.dividerTitle}>Calendly Integration</h3>
        <p className={styles.dividerDesc}>Coming soon.</p>
      </div>

      {/* Disconnect confirmation modal */}
      {confirmOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.backdrop} onClick={() => setConfirmOpen(false)} />
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Remove integration?</h3>
            <p className={styles.panelDesc}>
              Are you sure? This will stop all AI booking services. You can reconnect at any time.
            </p>
            <div className={styles.panelActions}>
              <button className={styles.btnConfirmCancel} onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button className={styles.btnConfirmDanger} onClick={handleDisconnect}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}