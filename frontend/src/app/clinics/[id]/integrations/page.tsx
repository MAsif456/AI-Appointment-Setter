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
  const [status, setStatus] = useState<ConnectionStatus>(
    initialMaskedKey ? 'connected' : 'disconnected',
  );
  // True once we have definitive data (either from props or the fetch)
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
    getClinicById(id).then((clinic) => {
      if (clinic.ghlApiKey) {
        setMaskedKey(clinic.ghlApiKey);
        setStatus('connected');
      }
      if (clinic.webhookUrl) setWebhookUrl(clinic.webhookUrl);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, [id, initialMaskedKey]);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 7000);
  }

  async function handleSave() {
    if (!apiKey.trim()) { showToast('error', 'Please enter an API key'); return; }
    setSaving(true);
    try {
      await updateClinicIntegration(id, apiKey.trim(), webhookUrl.trim() || undefined);
      const updated = await getClinicById(id);
      setMaskedKey(updated.ghlApiKey ?? '••••••••••••' + apiKey.slice(-6));
      setWebhookUrl(updated.webhookUrl ?? '');
      setApiKey('');
      setStatus('connected');
      showToast('success', 'Integration saved');
      onUpdated?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
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
        result.connected ? 'Connection successful' : 'Connection failed — check your API key',
      );
    } catch {
      setStatus('disconnected');
      showToast('error', 'Could not reach the server');
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectClinicIntegration(id);
      setMaskedKey('');
      setWebhookUrl('');
      setApiKey('');
      setStatus('disconnected');
      setConfirmOpen(false);
      showToast('success', 'Integration disconnected');
      onUpdated?.();
    } catch {
      setConfirmOpen(false);
      showToast('error', 'Failed to disconnect');
    }
  }

  const dot = status === 'connected' ? '#16a34a' : status === 'testing' ? '#d97706' : '#9ca3af';
  const label = status === 'connected' ? 'Connected' : status === 'testing' ? 'Testing…' : 'Not connected';

  return (
    <div style={{ maxWidth: 560, padding: '28px 0' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 6px' }}>
          GoHighLevel Integration
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          Connect this clinic to GoHighLevel to enable AI-powered booking and messaging.
        </p>
      </div>

      {/* Status row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 24,
          minHeight: 48,
        }}
      >
        {loaded ? (
          <>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: dot,
                flexShrink: 0,
                marginRight: 10,
              }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>{label}</span>
            {maskedKey && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.8125rem',
                  color: '#9ca3af',
                  letterSpacing: '0.05em',
                }}
              >
                {maskedKey}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Loading…</span>
        )}
      </div>

      {/* API key field */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, color: '#374151' }}>
          GHL API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={maskedKey ? 'Enter new key to replace' : 'Enter GHL private integration token'}
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: '0.875rem',
            boxSizing: 'border-box',
            outline: 'none',
            color: '#111827',
          }}
        />
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '5px 0 0' }}>
          Settings → Private Integrations in your GHL sub-account.
        </p>
      </div>

      {/* Webhook URL field */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, color: '#374151' }}>
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
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: '0.875rem',
            boxSizing: 'border-box',
            outline: 'none',
            color: '#111827',
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '9px 18px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        {maskedKey && (
          <>
            <button
              onClick={handleTest}
              disabled={status === 'testing'}
              style={{
                padding: '9px 18px',
                background: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: status === 'testing' ? 'not-allowed' : 'pointer',
              }}
            >
              Test
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              style={{
                padding: '9px 18px',
                background: '#fff',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginTop: 20,
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: '0.875rem',
            background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: toast.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          <span style={{ flexShrink: 0, fontWeight: 600 }}>
            {toast.type === 'success' ? '✓' : '!'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Disconnect confirmation modal */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setConfirmOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
            }}
          />
          {/* Panel */}
          <div
            style={{
              position: 'relative',
              background: '#fff',
              borderRadius: 12,
              padding: '28px 28px 24px',
              width: 360,
              maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
              Remove integration?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280' }}>
              The GHL API key will be removed for this clinic. You can reconnect at any time.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  padding: '8px 16px',
                  background: '#fff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
