'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import type { Clinic, ServiceArea, BusinessHours } from '@/types/clinic';
import BasicInfoSection from '@/components/clinics/BasicInfoSection';
import GhlIntegrationSection from '@/components/clinics/GhlIntegrationSection';
import ServiceConfigSection from '@/components/clinics/ServiceConfigSection';
import BusinessHoursSection, { type WeekHours, type DayHours } from '@/components/clinics/BusinessHoursSection';
import FormCard from '@/components/FormCard/FormCard';
import formStyles from '@/components/FormCard/FormCard.module.css';
import styles from '@/app/clinics/new/page.module.css';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function toWeekHours(bh: BusinessHours[]): WeekHours {
  const byDay = new Map(
    bh.map((entry) => [
      entry.day.charAt(0).toUpperCase() + entry.day.slice(1).toLowerCase(),
      entry,
    ])
  );

  const result: WeekHours = {};
  for (const day of ALL_DAYS) {
    const entry = byDay.get(day);
    result[day] = {
      open: entry?.isOpen ?? false,
      start: entry?.openTime ?? '09:00',
      end: entry?.closeTime ?? '17:00',
    };
  }
  return result;
}

function fromWeekHours(wh: WeekHours): BusinessHours[] {
  return Object.entries(wh).map(([day, hours]) => ({
    day: day.toLowerCase(),
    isOpen: hours.open,
    openTime: hours.start,
    closeTime: hours.end,
  }));
}

type Props = {
  clinic: Clinic;
  onSave: (updated: Partial<Clinic>) => Promise<void>;
  onCancel: () => void;
};

export type ClinicSettingsFormHandle = {
  submit: () => void;
};

const ClinicSettingsForm = forwardRef<ClinicSettingsFormHandle, Props>(function ClinicSettingsForm({ clinic, onSave }: Props, ref) {
  const [clinicName, setClinicName] = useState(clinic.name);
  const [address, setAddress] = useState(clinic.address ?? '');
  const [phoneNumber, setPhoneNumber] = useState(clinic.phone ?? '');
  const [ghlLocationId, setGhlLocationId] = useState(clinic.ghlLocationId ?? '');
  const [ghlCalendarId, setGhlCalendarId] = useState(clinic.ghlCalendarId ?? '');
  const [serviceAreas, setServiceAreas] = useState<string[]>(
    clinic.serviceAreas.map((a) => a.postcodePrefix)
  );
  const [servicesOffered, setServicesOffered] = useState<string[]>(
    (clinic.services ?? []).map((s) => s.name)
  );
  const [appointmentDuration, setAppointmentDuration] = useState(
    clinic.defaultAppointmentDuration ?? 30
  );
  const [dataRetentionMonths, setDataRetentionMonths] = useState(
    clinic.dataRetentionMonths ?? 12
  );
  const [businessHours, setBusinessHours] = useState<WeekHours>(toWeekHours(clinic.businessHours));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleFieldChange = (field: string, value: string | number | string[]) => {
    setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'serviceAreas' && Array.isArray(value)) {
      setServiceAreas(value);
    } else if (field === 'servicesOffered' && Array.isArray(value)) {
      setServicesOffered(value);
    } else {
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
    }
  };

  const handleHoursChange = (day: string, field: keyof DayHours, value: string | boolean) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!clinicName.trim()) {
      newErrors.clinicName = 'Clinic name is required';
    }
    if (!address.trim()) {
      newErrors.address = 'Address is required';
    }
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    }
    if (serviceAreas.length === 0) {
      newErrors.serviceAreas = 'At least one service area is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaveError(null);
    try {
      const updatedServiceAreas: ServiceArea[] = serviceAreas.map((prefix) => ({
        postcodePrefix: prefix,
      }));

      await onSave({
        name: clinicName,
        address,
        phone: phoneNumber,
        ghlLocationId,
        ghlCalendarId,
        serviceAreas: updatedServiceAreas,
        services: servicesOffered.map((name) => ({ name })),
        businessHours: fromWeekHours(businessHours),
        defaultAppointmentDuration: appointmentDuration,
        dataRetentionMonths,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
      return;
    }
  };

  useImperativeHandle(ref, () => ({ submit: handleSave }));

  return (
    <>
      {saveError && <div role="alert" className={styles.formError}>{saveError}</div>}

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
          onChange={handleFieldChange}
          errors={errors}
        />
        <BusinessHoursSection hours={businessHours} onChange={handleHoursChange} />
        <FormCard title="Additional Settings">
          <div className={formStyles.field}>
            <label className={formStyles.label}>Appointment Duration</label>
            <select
              className={formStyles.select}
              value={appointmentDuration}
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
              className={formStyles.select}
              value={dataRetentionMonths}
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
    </>
  );
});

export default ClinicSettingsForm;
