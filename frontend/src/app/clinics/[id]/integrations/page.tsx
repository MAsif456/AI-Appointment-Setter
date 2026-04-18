'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  updateClinicIntegration,
  testClinicIntegration,
  disconnectClinicIntegration,
  getClinicById,
} from '@/lib/api/clinics';

interface Props {
  /** Passed by ClinicDetailTabs; falls back to useParams when rendered as a standalone page. */
  clinicId?: string;
  /** Initial masked key from the already-loaded clinic, avoids an extra GET request. */
  initialMaskedKey?: string;
  /** Initial webhook URL from the already-loaded clinic. */
  initialWebhookUrl?: string;
  /** Called after a successful save/disconnect so the parent can refresh the clinic object. */
  onUpdated?: () => void;
}

type ConnectionStatus = 'idle' | 'connected' | 'disconnected' | 'testing';

/**
 * Per-clinic GoHighLevel integration settings page.
 * Can be rendered as a standalone Next.js page (via /clinics/[id]/integrations)
 * or embedded inside ClinicDetailTabs — both paths work.
 */
export default function ClinicIntegrationsPage({
  clinicId: propClinicId,
  initialMaskedKey = '',
  initialWebhookUrl = '',
  onUpdated,
}: Props) {
  const params = useParams<{ id: string }>();
  const id = propClinicId ?? params?.id ?? '';

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);

  // UI state
  const [maskedKey, setMaskedKey] = useState(initialMaskedKey);
  const [status, setStatus] = useState<ConnectionStatus>(
    initialMaskedKey ? 'connected' : 'disconnected',
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // When parent passes updated initial values (e.g. after a clinic reload), sync them.
  useEffect(() => {
    setMaskedKey(initialMaskedKey);
    setWebhookUrl(initialWebhookUrl);
    setStatus(initialMaskedKey ? 'connected' : 'disconnected');
  }, [initialMaskedKey, initialWebhookUrl]);

  // When rendered as a standalone page (no initialMaskedKey from parent), fetch clinic on mount.
  useEffect(() => {
    if (initialMaskedKey || !id) return;
    getClinicById(id).then((clinic) => {
      if (clinic.ghlApiKey) {
        setMaskedKey(clinic.ghlApiKey);
        setStatus('connected');
      }
      if (clinic.webhookUrl) {
        setWebhookUrl(clinic.webhookUrl);
      }
    }).catch(() => {});
  }, [id, initialMaskedKey]);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      showToast('error', 'Please enter an API key');
      return;
    }
    setSaving(true);
    try {
      await updateClinicIntegration(
        id,
        apiKey.trim(),
        webhookUrl.trim() || undefined,
      );
      // Re-fetch the clinic so we display the server-generated masked key
      const updated = await getClinicById(id);
      setMaskedKey(updated.ghlApiKey ?? '••••••••••••' + apiKey.slice(-6));
      setWebhookUrl(updated.webhookUrl ?? '');
      setApiKey('');
      setStatus('connected');
      showToast('success', 'Integration settings saved successfully');
      onUpdated?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setStatus('testing');
    try {
      const result = await testClinicIntegration(id);
      setStatus(result.connected ? 'connected' : 'disconnected');
      showToast(
        result.connected ? 'success' : 'error',
        result.connected
          ? 'Connection successful'
          : 'Connection failed — check your API key',
      );
    } catch {
      setStatus('disconnected');
      showToast('error', 'Failed to test connection');
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Remove the GHL API key for this clinic? You can reconnect at any time.')) return;
    try {
      await disconnectClinicIntegration(id);
      setMaskedKey('');
      setWebhookUrl('');
      setApiKey('');
      setStatus('disconnected');
      showToast('success', 'Integration disconnected successfully');
      onUpdated?.();
    } catch {
      showToast('error', 'Failed to disconnect integration');
    }
  }

  const statusColour =
    status === 'connected'
      ? '#16a34a'
      : status === 'testing'
        ? '#d97706'
        : '#dc2626';

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'testing'
        ? 'Testing…'
        : 'Not connected';

  return (
    <div style={{ maxWidth: 600, padding: '24px 0' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 4 }}>
        GoHighLevel Integration
      </h2>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: '0.875rem' }}>
        Connect this clinic to GoHighLevel to enable AI-powered appointment booking.
      </p>

      {/* Connection status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: statusColour,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '0.875rem', color: statusColour, fontWeight: 500 }}>
          {statusLabel}
        </span>
        {maskedKey && (
          <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 8 }}>
            {maskedKey}
          </span>
        )}
      </div>

      {/* API key input */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}
        >
          GHL API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={maskedKey || 'Enter GHL private integration token'}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: '0.875rem',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
          Found in your GHL sub-account under Settings → Integrations → Private Integrations.
        </p>
      </div>

      {/* Webhook URL input */}
      <div style={{ marginBottom: 24 }}>
        <label
          style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}
        >
          Webhook URL{' '}
          <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-domain.com/webhooks/ghl"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: '0.875rem',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 16px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '0.875rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save & Validate'}
        </button>

        {maskedKey && (
          <>
            <button
              onClick={handleTest}
              disabled={status === 'testing'}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: '0.875rem',
                cursor: status === 'testing' ? 'not-allowed' : 'pointer',
              }}
            >
              Test Connection
            </button>
            <button
              onClick={handleDisconnect}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: 6,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: 6,
            fontSize: '0.875rem',
            background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: toast.type === 'success' ? '#15803d' : '#dc2626',
            border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {toast.message}
        </div>
      )}

    </div>
  );
}
