'use client';

import FormCard from '@/components/FormCard/FormCard';
import styles from '@/components/FormCard/FormCard.module.css';

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 105, 120];
const RETENTION_OPTIONS = [3, 6, 12, 18, 24, 36];

interface ServiceConfigSectionProps {
  serviceAreas: string;
  servicesOffered: string;
  appointmentDuration: number;
  dataRetentionMonths: number;
  onChange: (field: string, value: string | number) => void;
  errors: Record<string, string>;
}

/** Service configuration — postcode areas, services offered, and appointment duration. */
export default function ServiceConfigSection({
  serviceAreas,
  servicesOffered,
  appointmentDuration,
  dataRetentionMonths,
  onChange,
  errors,
}: ServiceConfigSectionProps) {
  return (
    <FormCard title="Service Configuration">
      <div className={styles.field}>
        <label className={styles.label}>Service Areas</label>
        <input
          className={`${styles.input} ${errors.serviceAreas ? styles.inputError : ''}`}
          type="text"
          placeholder="e.g., CF, NP, SA (comma separated)"
          value={serviceAreas}
          onChange={(e) => onChange('serviceAreas', e.target.value)}
          data-field="serviceAreas"
        />
        <span className={styles.helperText}>Enter postcode prefixes separated by commas</span>
        {errors.serviceAreas && (
          <span className={styles.errorText}>{errors.serviceAreas}</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Services Offered</label>
        <input
          className={styles.input}
          type="text"
          placeholder="e.g., Back pain, Sports injury"
          value={servicesOffered}
          onChange={(e) => onChange('servicesOffered', e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Appointment Duration</label>
        <select
          className={styles.select}
          value={appointmentDuration}
          onChange={(e) => onChange('appointmentDuration', Number(e.target.value))}
        >
          {DURATION_OPTIONS.map((mins) => (
            <option key={mins} value={mins}>
              {mins} minutes
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Data Retention Period</label>
        <select
          className={styles.select}
          value={dataRetentionMonths}
          onChange={(e) => onChange('dataRetentionMonths', Number(e.target.value))}
        >
          {RETENTION_OPTIONS.map((months) => (
            <option key={months} value={months}>
              {months} months
            </option>
          ))}
        </select>
        <span className={styles.helperText}>
          Patient data is automatically anonymised after this period of inactivity (GDPR Art. 5(1)(e))
        </span>
      </div>
    </FormCard>
  );
}
