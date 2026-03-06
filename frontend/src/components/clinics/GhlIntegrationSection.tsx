'use client';

import FormCard from '@/components/FormCard/FormCard';
import styles from '@/components/FormCard/FormCard.module.css';

interface GhlIntegrationSectionProps {
  locationId: string;
  calendarId: string;
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

/** GoHighLevel integration fields — location ID and calendar ID (both required). */
export default function GhlIntegrationSection({
  locationId,
  calendarId,
  onChange,
  errors,
}: GhlIntegrationSectionProps) {
  return (
    <FormCard title="GoHighLevel Integration">
      <div className={styles.field}>
        <label className={styles.label}>
          GHL Location ID<span className={styles.required}>*</span>
        </label>
        <input
          className={`${styles.input} ${errors.ghlLocationId ? styles.inputError : ''}`}
          type="text"
          value={locationId}
          onChange={(e) => onChange('ghlLocationId', e.target.value)}
          data-field="ghlLocationId"
        />
        <span className={styles.helperText}>Found in GHL sub-account settings</span>
        {errors.ghlLocationId && (
          <span className={styles.errorText}>{errors.ghlLocationId}</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          GHL Calendar ID<span className={styles.required}>*</span>
        </label>
        <input
          className={`${styles.input} ${errors.ghlCalendarId ? styles.inputError : ''}`}
          type="text"
          value={calendarId}
          onChange={(e) => onChange('ghlCalendarId', e.target.value)}
          data-field="ghlCalendarId"
        />
        <span className={styles.helperText}>The calendar to book appointments into</span>
        {errors.ghlCalendarId && (
          <span className={styles.errorText}>{errors.ghlCalendarId}</span>
        )}
      </div>
    </FormCard>
  );
}
