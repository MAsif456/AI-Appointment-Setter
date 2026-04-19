'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/apiAxios';
import { useAuth } from '@/contexts/AuthContext';
import styles from '../settings.module.css';

interface NotificationPrefs {
  generalNotifications: boolean;
  emailNotifications: boolean;
  stalledConversations: boolean;
  escalatedConversations: boolean;
  bookingCancelled: boolean;
  newUserJoined: boolean;
  appointmentReminders: boolean;
  gdprDataDeletion: boolean;
}

const DEFAULTS: NotificationPrefs = {
  generalNotifications: true,
  emailNotifications: true,
  stalledConversations: true,
  escalatedConversations: true,
  bookingCancelled: true,
  newUserJoined: true,
  appointmentReminders: true,
  gdprDataDeletion: true,
};

type ToggleConfig = { key: keyof Omit<NotificationPrefs, 'generalNotifications'>; label: string; description: string; adminOnly?: boolean };

const TOGGLES: ToggleConfig[] = [
  { key: 'emailNotifications', label: 'Email notifications', description: 'Receive email updates about new conversations' },
  { key: 'stalledConversations', label: 'Stalled conversations', description: 'Alert when a conversation has gone quiet' },
  { key: 'escalatedConversations', label: 'Escalated conversations', description: 'Alert when a conversation is escalated and needs urgent attention' },
  { key: 'bookingCancelled', label: 'Booking cancelled', description: 'Notify when a patient cancels a booked appointment' },
  { key: 'newUserJoined', label: 'New user joined', description: 'Notify when a new staff account is created', adminOnly: true },
  { key: 'appointmentReminders', label: 'Appointment reminders', description: 'Get notified about upcoming scheduled appointments' },
  { key: 'gdprDataDeletion', label: 'Data deletion requests', description: 'Notify when a staff member requests erasure of a patient\'s data', adminOnly: true },
];

/**
 * Notification Preferences tab — loads preferences from the API on mount,
 * lets the user toggle each option, and saves via PATCH on "Save Preferences".
 * Cancel reverts to the last saved state without an API call.
 */
export default function NotificationPreferences() {
  const { isAdmin } = useAuth();
  const [saved, setSaved] = useState<NotificationPrefs>(DEFAULTS);
  const [current, setCurrent] = useState<NotificationPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [toast, setToast] = useState('');

  const isDirty = JSON.stringify(current) !== JSON.stringify(saved);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await api.get<NotificationPrefs>('/users/me/notification-preferences');
      setSaved(data);
      setCurrent(data);
    } catch {
      setLoadError('Failed to load notification preferences. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (key: keyof NotificationPrefs, value: boolean) => {
    setCurrent(prev => ({ ...prev, [key]: value }));
  };

  const handleGeneralToggle = () => {
    setCurrent(prev => ({ ...prev, generalNotifications: !prev.generalNotifications }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const { data } = await api.patch<NotificationPrefs>('/users/me/notification-preferences', current);
      setSaved(data);
      setCurrent(data);
      showToast('Preferences saved successfully');
    } catch {
      setSaveError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCurrent(saved);
    setSaveError('');
  };

  if (loading) {
    return <div className={styles.loadingState}>Loading preferences...</div>;
  }

  if (loadError) {
    return <div className={styles.errorAlert}>{loadError}</div>;
  }

  const individualDisabled = !current.generalNotifications;

  return (
    <div>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Notification Preferences</h2>
          <p className={styles.sectionDesc}>Manage how and when you receive notifications</p>
        </div>
      </div>

      <div className={styles.infoCard} style={{ maxWidth: 680, gap: 0, padding: 0, overflow: 'hidden' }}>
        {/* General notifications — master switch */}
        <ToggleRow
          label="General notifications"
          description="Enable or disable all notifications"
          checked={current.generalNotifications}
          onChange={handleGeneralToggle}
          disabled={false}
          isMaster
        />

        {/* Individual toggles — adminOnly ones are hidden from staff */}
        {TOGGLES.filter(t => !t.adminOnly || isAdmin).map(({ key, label, description }) => (
          <ToggleRow
            key={key}
            label={label}
            description={description}
            checked={current[key]}
            onChange={() => setField(key, !current[key])}
            disabled={individualDisabled}
          />
        ))}
      </div>

      {saveError && <div className={styles.errorAlert} style={{ marginTop: 16 }}>{saveError}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end', maxWidth: 680 }}>
        <button
          className={styles.outlineButton}
          onClick={handleCancel}
          disabled={!isDirty || saving}
        >
          Cancel
        </button>
        <button
          className={styles.primaryButton}
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles.toast_success}`} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  isMaster?: boolean;
}

function ToggleRow({ label, description, checked, onChange, disabled, isMaster }: ToggleRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        borderBottom: '1px solid #f1f5f9',
        opacity: disabled ? 0.5 : 1,
        background: isMaster ? '#f8fafc' : '#fff',
      }}
    >
      <div>
        <div style={{ fontSize: '0.925rem', fontWeight: isMaster ? 600 : 500, color: '#0f172a' }}>{label}</div>
        <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: 2 }}>{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={disabled ? undefined : onChange}
        disabled={disabled}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? '#2563eb' : '#cbd5e1',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  );
}
