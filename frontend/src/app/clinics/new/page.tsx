'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackArrowIcon } from '@/components/Icons';
import BasicInfoSection from '@/components/clinics/BasicInfoSection';
import GhlIntegrationSection from '@/components/clinics/GhlIntegrationSection';
import ServiceConfigSection from '@/components/clinics/ServiceConfigSection';
import BusinessHoursSection from '@/components/clinics/BusinessHoursSection';
import type { WeekHours, DayHours } from '@/components/clinics/BusinessHoursSection';
import { createClinic, type ApiError } from '@/services/clinicService';
import styles from './page.module.css';

/** Default business hours — weekdays open 09:00–17:00, weekends closed. */
function getDefaultHours(): WeekHours {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours: WeekHours = {};
  for (const day of days) {
    hours[day] = {
      open: !['Saturday', 'Sunday'].includes(day),
      start: '09:00',
      end: '17:00',
    };
  }
  return hours;
}

/**
 * Page to add a new clinic. Contains fields for basic information, GHL integration, services offered, and business hours.
 *
 * On successful save, redirects to /clinics and shows a success toast.
 *
 * On error, shows field-specific errors or a generic error message.
 */
export default function AddClinicPage() {
  const router = useRouter();

  const [clinicName, setClinicName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ghlLocationId, setGhlLocationId] = useState('');
  const [ghlCalendarId, setGhlCalendarId] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [servicesOffered, setServicesOffered] = useState('');
  const [appointmentDuration, setAppointmentDuration] = useState(30);
  const [businessHours, setBusinessHours] = useState<WeekHours>(getDefaultHours);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showToast, setShowToast] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** Route field-name changes to the correct setter. */
  const handleFieldChange = (field: string, value: string | number) => {
    setErrors((prev) => ({ ...prev, [field]: '' }));
    const setters: Record<string, (v: never) => void> = {
      clinicName: setClinicName as (v: never) => void,
      address: setAddress as (v: never) => void,
      phoneNumber: setPhoneNumber as (v: never) => void,
      ghlLocationId: setGhlLocationId as (v: never) => void,
      ghlCalendarId: setGhlCalendarId as (v: never) => void,
      serviceAreas: setServiceAreas as (v: never) => void,
      servicesOffered: setServicesOffered as (v: never) => void,
      appointmentDuration: setAppointmentDuration as (v: never) => void,
    };
    setters[field]?.(value as never);
  };

/**
 * Update the business hours state with the new value for the given day and field.
 *
 * @param {string} day - The day of the week (e.g. 'monday', 'tuesday', etc.)
 * @param {keyof DayHours} field - The field to update (e.g. 'open', 'startTime', 'endTime')
 * @param {string|boolean} value - The new value for the given day and field
 */
  const handleHoursChange = (day: string, field: keyof DayHours, value: string | boolean) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  /** Validate all fields, then call the API. Shows field errors or a success toast. */
  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    // Required + format checks
    if (!clinicName.trim()) {
      newErrors.clinicName = 'Clinic name is required';
    } else if (clinicName.trim().length < 2) {
      newErrors.clinicName = 'Clinic name must be at least 2 characters';
    }

    if (!ghlLocationId.trim()) {
      newErrors.ghlLocationId = 'GHL Location ID is required';
    } else if (!/^[a-zA-Z0-9_]+$/.test(ghlLocationId.trim())) {
      newErrors.ghlLocationId = 'GHL Location ID must be alphanumeric';
    }

    if (!ghlCalendarId.trim()) {
      newErrors.ghlCalendarId = 'GHL Calendar ID is required';
    } else if (!/^[a-zA-Z0-9_]+$/.test(ghlCalendarId.trim())) {
      newErrors.ghlCalendarId = 'GHL Calendar ID must be alphanumeric';
    }

    // Optional field format checks
    if (phoneNumber.trim() && !/^(\+44\s?|0)\d[\d\s]{8,12}$/.test(phoneNumber.trim())) {
      newErrors.phoneNumber = 'Enter a valid UK phone number (e.g. 029 2034 5678 or +44 29 2034 5678)';
    }

    if (serviceAreas.trim()) {
      const prefixes = serviceAreas.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      const invalid = prefixes.find((p) => !/^[A-Z]{1,4}$/.test(p));
      if (invalid) {
        newErrors.serviceAreas = `"${invalid}" is not a valid postcode prefix (e.g. CF, NP, SA)`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to the first field with an error
      const firstErrorField = Object.keys(newErrors)[0];
      const el = document.querySelector(`[data-field="${firstErrorField}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      await createClinic({
        clinicName,
        address,
        phoneNumber,
        ghlLocationId,
        ghlCalendarId,
        serviceAreas,
        servicesOffered,
        appointmentDuration,
        businessHours,
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
          <button className={styles.cancelButton} onClick={() => router.push('/clinics')}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Clinic'}
          </button>
        </div>
      </div>

      <div className={styles.sections}>
        <BasicInfoSection
          clinicName={clinicName}
          address={address}
          phoneNumber={phoneNumber}
          onChange={handleFieldChange}
          errors={errors}
        />
        <GhlIntegrationSection
          locationId={ghlLocationId}
          calendarId={ghlCalendarId}
          onChange={handleFieldChange}
          errors={errors}
        />
        <ServiceConfigSection
          serviceAreas={serviceAreas}
          servicesOffered={servicesOffered}
          appointmentDuration={appointmentDuration}
          onChange={handleFieldChange}
          errors={errors}
        />
        <BusinessHoursSection hours={businessHours} onChange={handleHoursChange} />
      </div>

      <div className={styles.footerActions}>
        <button className={styles.cancelButton} onClick={() => router.push('/clinics')}>
          Cancel
        </button>
        <button className={styles.saveButton} onClick={handleSave} disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Clinic'}
        </button>
      </div>

      {errors.form && <div className={styles.formError}>{errors.form}</div>}
      {showToast && <div className={styles.toast}>Clinic created successfully</div>}
    </div>
  );
}
