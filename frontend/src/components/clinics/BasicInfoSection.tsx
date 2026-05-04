'use client';

import FormCard from '@/components/FormCard/FormCard';
import styles from '@/components/FormCard/FormCard.module.css';

interface BasicInfoSectionProps {
  clinicName: string;
  address: string;
  phoneNumber: string;
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

/** Basic clinic details — name, address, and phone number are all required. */
export default function BasicInfoSection({
  clinicName,
  address,
  phoneNumber,
  onChange,
  errors,
}: BasicInfoSectionProps) {
  return (
    <FormCard title="Basic Information">
      <div className={styles.field}>
        <label className={styles.label}>
          Clinic Name<span className={styles.required}>*</span>
        </label>
        <input
          className={`${styles.input} ${errors.clinicName ? styles.inputError : ''}`}
          type="text"
          value={clinicName}
          onChange={(e) => onChange('clinicName', e.target.value)}
          data-field="clinicName"
        />
        {errors.clinicName && (
          <span className={styles.errorText}>{errors.clinicName}</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Address<span className={styles.required}>*</span>
        </label>
        <input
          className={`${styles.input} ${errors.address ? styles.inputError : ''}`}
          type="text"
          value={address}
          onChange={(e) => onChange('address', e.target.value)}
          data-field="address"
        />
        {errors.address && (
          <span className={styles.errorText}>{errors.address}</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Phone Number<span className={styles.required}>*</span>
        </label>
        <input
          className={`${styles.input} ${errors.phoneNumber ? styles.inputError : ''}`}
          type="text"
          value={phoneNumber}
          onChange={(e) => onChange('phoneNumber', e.target.value)}
          data-field="phoneNumber"
        />
        {errors.phoneNumber && (
          <span className={styles.errorText}>{errors.phoneNumber}</span>
        )}
      </div>
    </FormCard>
  );
}
