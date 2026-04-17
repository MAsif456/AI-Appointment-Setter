'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import type { Clinic, ServiceArea, BusinessHours } from '@/types/clinic';
import BasicInfoSection from '@/components/clinics/BasicInfoSection';
import GhlIntegrationSection from '@/components/clinics/GhlIntegrationSection';
import ServiceConfigSection from '@/components/clinics/ServiceConfigSection';
import BusinessHoursSection, { type WeekHours, type DayHours } from '@/components/clinics/BusinessHoursSection';
import styles from '@/app/clinics/new/page.module.css';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function toWeekHours(bh: BusinessHours[]): WeekHours {
  // Index API entries by capitalised day name
  const byDay = new Map(
    bh.map((entry) => [
      entry.day.charAt(0).toUpperCase() + entry.day.slice(1).toLowerCase(),
      entry,
    ])
  );

  // Ensure all 7 days always exist so BusinessHoursSection never gets undefined
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
  const [serviceAreas, setServiceAreas] = useState(
    clinic.serviceAreas.map((a) => a.postcodePrefix).join(', ')
  );
  const [servicesOffered, setServicesOffered] = useState('');
  const [appointmentDuration, setAppointmentDuration] = useState(
    clinic.defaultAppointmentDuration ?? 30
  );
  const [dataRetentionMonths, setDataRetentionMonths] = useState(
    clinic.dataRetentionMonths ?? 12
  );
  const [businessHours, setBusinessHours] = useState<WeekHours>(toWeekHours(clinic.businessHours));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

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
      dataRetentionMonths: setDataRetentionMonths as (v: never) => void,
    };
    setters[field]?.(value as never);
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
    if (!serviceAreas.trim()) {
      newErrors.serviceAreas = 'At least one service area is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaveError(null);
    try {
      const updatedServiceAreas: ServiceArea[] = serviceAreas
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .map((prefix) => ({ postcodePrefix: prefix }));

      await onSave({
        name: clinicName,
        address,
        phone: phoneNumber,
        ghlLocationId,
        ghlCalendarId,
        serviceAreas: updatedServiceAreas,
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
          appointmentDuration={appointmentDuration}
          dataRetentionMonths={dataRetentionMonths}
          onChange={handleFieldChange}
          errors={errors}
        />
        <BusinessHoursSection hours={businessHours} onChange={handleHoursChange} />
      </div>
    </>
  );
});

export default ClinicSettingsForm;
