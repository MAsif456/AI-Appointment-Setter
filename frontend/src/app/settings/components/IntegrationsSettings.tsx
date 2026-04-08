'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Wifi, WifiOff, Loader } from 'lucide-react';
import api from '@/lib/apiAxios';
import styles from '../settings.module.css';

interface IntegrationSettings {
  ghlApiKey: string;
  webhookUrl: string;
  ghlConnectionStatus: 'connected' | 'disconnected';
}

/** Validates that a URL is a valid HTTPS URL. */
function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Integrations tab — allows staff to manage the GoHighLevel API key
 * and webhook URL. Shows live connection status and supports
 * Save / Cancel / Disconnect actions.
 */
export default function IntegrationsSettings() {
  const [saved, setSaved] = useState<IntegrationSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<IntegrationSettings>('/api/integrations');
      setSaved(data);
      setApiKey('');           // never pre-fill — masked value is display only
      setWebhookUrl(data.webhookUrl);
    } catch {
      setError('Failed to load integration settings. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** True when the user has changed at least one field from its saved state. */
  const isDirty =
    apiKey.length > 0 || webhookUrl !== (saved?.webhookUrl ?? '');

  /** Client-side validation before sending to the backend. */
  function validate(): string {
    if (apiKey && apiKey.length < 10) return 'API key must be at least 10 characters.';
    if (webhookUrl && !isValidHttpsUrl(webhookUrl)) return 'Webhook URL must be a valid HTTPS URL.';
    return '';
  }

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body: Record<string, string> = {};
      if (apiKey) body.ghlApiKey = apiKey;
      if (webhookUrl !== saved?.webhookUrl) body.webhookUrl = webhookUrl;

      const { data } = await api.put<IntegrationSettings>('/api/integrations', body);
      setSaved(data);
      setApiKey('');
      setWebhookUrl(data.webhookUrl);
      setSuccess('Settings saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setApiKey('');
    setWebhookUrl(saved?.webhookUrl ?? '');
    setError('');
    setSuccess('');
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError('');
    try {
      await api.post('/api/integrations/disconnect');
      await load();
      setSuccess('GoHighLevel integration disconnected.');
    } catch {
      setError('Failed to disconnect. Please try again.');
    } finally {
      setDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  };

  if (loading) return <div className={styles.loadingState}>Loading integration settings…</div>;

  const isConnected = saved?.ghlConnectionStatus === 'connected';

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>GoHighLevel Integration</h2>
          <p className={styles.sectionDesc}>
            Manage the API credentials and webhook URL powering the AI booking system.
          </p>
        </div>
        {/* Connection status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isConnected
            ? <Wifi size={16} color="#16a34a" />
            : <WifiOff size={16} color="#dc2626" />}
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: isConnected ? '#16a34a' : '#dc2626' }}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>
      </div>

      <div className={styles.infoCard}>
        {error && <div className={styles.errorAlert}>{error}</div>}
        {success && <div className={styles.successAlert}>{success}</div>}

        {/* API Key field */}
        <div className={styles.formGroup}>
          <label className={styles.label}>GHL Private Integration Token</label>
          <p className={styles.labelDesc}>
            Authenticates all communication with GoHighLevel. Rotate every 90 days.
          </p>
          <div className={styles.passwordWrapper}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey || (!showKey && saved?.ghlApiKey ? saved.ghlApiKey : apiKey)}
              onChange={(e) => setApiKey(e.target.value)}
              onFocus={() => { if (!apiKey) setApiKey(''); }}
              placeholder={saved?.ghlApiKey ? 'Enter new token to replace current' : 'Enter your GHL Private Integration Token'}
              className={styles.input}
              autoComplete="off"
            />
            <button type="button" className={styles.eyeButton} onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Webhook URL field */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Webhook URL</label>
          <p className={styles.labelDesc}>
            The HTTPS URL where GoHighLevel delivers ContactCreate and InboundMessage events.
          </p>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-domain.com/webhooks/ghl"
            className={styles.input}
          />
        </div>

        {/* Save / Cancel */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? <><Loader size={14} /> Saving…</> : 'Save Changes'}
          </button>
          {isDirty && (
            <button className={styles.outlineButton} onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
          )}
        </div>

        {/* Disconnect */}
        {isConnected && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
            {!showDisconnectConfirm ? (
              <button className={styles.dangerButton} onClick={() => setShowDisconnectConfirm(true)}>
                Disconnect
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                  Are you sure? This will stop all AI booking services.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className={styles.dangerButton} onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? 'Disconnecting…' : 'Yes, Disconnect'}
                  </button>
                  <button className={styles.outlineButton} onClick={() => setShowDisconnectConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calendly placeholder */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
            Calendly Integration
          </h3>
          <p className={styles.sectionDesc}>Coming soon.</p>
        </div>
      </div>
    </div>
  );
}
