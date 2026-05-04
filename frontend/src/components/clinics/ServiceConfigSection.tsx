'use client';

import { useState } from 'react';
import FormCard from '@/components/FormCard/FormCard';
import styles from './ServiceConfigSection.module.css';

/** Preset services for the dropdown — at least 10 options. */
const PRESET_SERVICES = [
  'Back pain',
  'Sports injury',
  'Joint problems',
  'Rehabilitation',
  'Neck pain',
  'Sciatica',
  'Post-surgery recovery',
  'Shoulder pain',
  'Knee injury',
  'Muscle strain',
  'Posture correction',
  'Headache & migraine',
];

/** Preset postcode prefixes for the dropdown — at least 6 options. */
const PRESET_AREAS = ['CF', 'NP', 'SA', 'LD', 'SY', 'HR', 'GL', 'BS'];

interface ServiceConfigSectionProps {
  serviceAreas: string[];
  servicesOffered: string[];
  onChange: (field: string, value: string[]) => void;
  errors: Record<string, string>;
}

/** Services & Locations — pill-based editor with dropdown + custom input. */
export default function ServiceConfigSection({
  serviceAreas,
  servicesOffered,
  onChange,
  errors,
}: ServiceConfigSectionProps) {
  const [customService, setCustomService] = useState('');
  const [customArea, setCustomArea] = useState('');

  // ── Services Offered ──
  const addService = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !servicesOffered.includes(trimmed)) {
      onChange('servicesOffered', [...servicesOffered, trimmed]);
    }
  };

  const removeService = (name: string) => {
    onChange('servicesOffered', servicesOffered.filter((s) => s !== name));
  };

  const handleServiceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) {
      addService(e.target.value);
      e.target.value = '';
    }
  };

  const handleAddCustomService = () => {
    if (customService.trim()) {
      addService(customService.trim());
      setCustomService('');
    }
  };

  // ── Service Areas ──
  const addArea = (prefix: string) => {
    const trimmed = prefix.trim().toUpperCase();
    if (trimmed && !serviceAreas.includes(trimmed)) {
      onChange('serviceAreas', [...serviceAreas, trimmed]);
    }
  };

  const removeArea = (prefix: string) => {
    onChange('serviceAreas', serviceAreas.filter((a) => a !== prefix));
  };

  const handleAreaSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) {
      addArea(e.target.value);
      e.target.value = '';
    }
  };

  const handleAddCustomArea = () => {
    if (customArea.trim()) {
      addArea(customArea.trim());
      setCustomArea('');
    }
  };

  // Available options (exclude already-selected)
  const availableServices = PRESET_SERVICES.filter((s) => !servicesOffered.includes(s));
  const availableAreas = PRESET_AREAS.filter((a) => !serviceAreas.includes(a));

  return (
    <FormCard title="Services & Locations">
      {/* ── Services Offered ── */}
      <div className={styles.field}>
        <label className={styles.label}>Services Offered</label>
        <div className={styles.pillRow}>
          {servicesOffered.map((s) => (
            <span key={s} className={styles.pill}>
              {s}
              <button
                type="button"
                className={styles.pillRemove}
                onClick={() => removeService(s)}
                aria-label={`Remove ${s}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <select
          className={styles.select}
          defaultValue=""
          onChange={handleServiceSelect}
        >
          <option value="" disabled>Select a service...</option>
          {availableServices.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            type="text"
            placeholder="Or add a custom service..."
            value={customService}
            onChange={(e) => setCustomService(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomService(); } }}
          />
          <button type="button" className={styles.addBtn} onClick={handleAddCustomService}>
            + Add
          </button>
        </div>
      </div>

      {/* ── Service Areas ── */}
      <div className={styles.field}>
        <label className={styles.label}>
          Service Areas (Postcode Prefixes)<span className={styles.required}>*</span>
        </label>
        <div className={styles.pillRow}>
          {serviceAreas.map((a) => (
            <span key={a} className={styles.pillArea}>
              {a}
              <button
                type="button"
                className={styles.pillRemove}
                onClick={() => removeArea(a)}
                aria-label={`Remove ${a}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {errors.serviceAreas && (
          <span className={styles.errorText}>{errors.serviceAreas}</span>
        )}
        <select
          className={styles.select}
          defaultValue=""
          onChange={handleAreaSelect}
        >
          <option value="" disabled>Select a service area...</option>
          {availableAreas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            type="text"
            placeholder="Or add a custom postcode prefix..."
            value={customArea}
            onChange={(e) => setCustomArea(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomArea(); } }}
          />
          <button type="button" className={styles.addBtn} onClick={handleAddCustomArea}>
            + Add
          </button>
        </div>
        <span className={styles.helperText}>
          These postcode prefixes determine which areas your clinic serves
        </span>
      </div>
    </FormCard>
  );
}
