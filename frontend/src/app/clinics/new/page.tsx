'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackArrowIcon } from '@/components/Icons';
import BasicInfoSection from '@/components/clinics/BasicInfoSection';
import GhlIntegrationSection from '@/components/clinics/GhlIntegrationSection';
import ServiceConfigSection from '@/components/clinics/ServiceConfigSection';
import BusinessHoursSection from '@/components/clinics/BusinessHoursSection';
import FormCard from '@/components/FormCard/FormCard';
import formStyles from '@/components/FormCard/FormCard.module.css';
import type { DayHours } from '@/components/clinics/BusinessHoursSection';
import { createClinic, type ApiError } from '@/services/clinicService';
import { getDefaultHours, validateClinicForm } from './clinicFormHelpers';
import styles from './page.module.css';

/**
 * Page to add a new clinic. Contains fields for basic information,
 * GHL integration, services offered, and business hours.
 */
export default function AddClinicPage() {
  const router = useRouter();

  const [clinicName, setClinicName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ghlLocationId, setGhlLocationId] = useState('');
  const [ghlCalendarId, setGhlCalendarId] = useState('');
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [servicesOffered, setServicesOffered] = useState<string[]>([]);
  const [appointmentDuration, setAppointmentDuration] = useState(30);
  const [dataRetentionMonths, setDataRetentionMonths] = useState(12);
  const [businessHours, setBusinessHours] = useState(getDefaultHours);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showToast, setShowToast] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** Route field-name changes to the correct setter. */
  const handleFieldChange = (field: string, value: string | number | string[]) => {
    setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'serviceAreas' && Array.isArray(value)) { setServiceAreas(value); return; }
    if (field === 'servicesOffered' && Array.isArray(value)) { setServicesOffered(value); return; }
    const setters: Record<string, (v: never) => void> = {
      clinicName: setClinicName as (v: never) => void,
      address: setAddress as (v: never) => void,
      phoneNumber: setPhoneNumber as (v: never) => void,
      ghlLocationId: setGhlLocationId as (v: never) => void,
      ghlCalendarId: setGhlCalendarId as (v: never) => void,
      appointmentDuration: setAppointmentDuration as (v: never) => void,
      dataRetentionMonths: setDataRetentionMonths as (v: never) => void,
    };
    setters[field]?.(value as never);
  };

  /** Update business hours for the given day and field. */
  const handleHoursChange = (day: string, field: keyof DayHours, value: string | boolean) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  /** Validate all fields, then call the API. Shows field errors or a success toast. */
  const handleSave = async () => {
    const newErrors = validateClinicForm({
      clinicName, address, phoneNumber, ghlLocationId, ghlCalendarId, serviceAreas,
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorField = Object.keys(newErrors)[0];
      const el = document.querySelector(`[data-field="${firstErrorField}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      await createClinic({
        clinicName, address, phoneNumber, ghlLocationId, ghlCalendarId,
        serviceAreas, servicesOffered, appointmentDuration, dataRetentionMonths, businessHours,
      });
      setShowToast(true);
      setTimeout(() => router.push('/clinics'), 1500);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 409) {
        setErrors({ ghlLocationId: apiErr.message });
      } else {
        setErrors({ form: apiErr.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Link href="/clinics" className={styles.backLink}>
        <BackArrowIcon className={styles.backIcon} />
        Back to Clinics
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Add New Clinic</h1>
        <div className={styles.headerActions}>
          <button className={styles.cancelButton} onClick={() => router.push('/clinics')}>Cancel</button>
          <button className={styles.saveButton} onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Clinic'}
          </button>
        </div>
      </div>

      <div className={styles.sections}>
        <BasicInfoSection
          clinicName={clinicName} address={address} phoneNumber={phoneNumber}
          onChange={handleFieldChange} errors={errors}
        />
        <GhlIntegrationSection
          locationId={ghlLocationId} calendarId={ghlCalendarId}
          onChange={handleFieldChange} errors={errors}
        />
        <ServiceConfigSection
          serviceAreas={serviceAreas} servicesOffered={servicesOffered}
          onChange={handleFieldChange} errors={errors}
        />
        <BusinessHoursSection hours={businessHours} onChange={handleHoursChange} />
        <FormCard title="Additional Settings">
          <div className={formStyles.field}>
            <label className={formStyles.label}>Appointment Duration</label>
            <select
              className={formStyles.select} value={appointmentDuration}
              onChange={(e) => handleFieldChange('appointmentDuration', Number(e.target.value))}
            >
              {[15, 20, 30, 45, 60, 75, 90, 105, 120].map((mins) => (
                <option key={mins} value={mins}>{mins} minutes</option>
              ))}
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Data Retention Period</label>
            <select
              className={formStyles.select} value={dataRetentionMonths}
              onChange={(e) => handleFieldChange('dataRetentionMonths', Number(e.target.value))}
            >
              {[3, 6, 12, 18, 24, 36].map((months) => (
                <option key={months} value={months}>{months} months</option>
              ))}
            </select>
            <span className={formStyles.helperText}>
              Patient data is automatically anonymised after this period of inactivity (GDPR Art. 5(1)(e))
            </span>
          </div>
        </FormCard>
      </div>

      <div className={styles.footerActions}>
        <button className={styles.cancelButton} onClick={() => router.push('/clinics')}>Cancel</button>
        <button className={styles.saveButton} onClick={handleSave} disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Clinic'}
        </button>
      </div>

      {errors.form && <div className={styles.formError}>{errors.form}</div>}
      {showToast && <div className={styles.toast}>Clinic created successfully</div>}
    </div>
  );
}
