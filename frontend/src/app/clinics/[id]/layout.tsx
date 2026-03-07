'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ClinicDetailHeader from '@/components/ClinicDetail/ClinicDetailHeader';
import ClinicDetailTabs from '@/components/ClinicDetail/ClinicDetailTabs';
import { fetchClinicById } from '@/lib/clinics-api';
import { Clinic } from '@/types/clinic';

/** Props for the clinic detail layout. */
interface ClinicLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared layout for all clinic detail sub-pages.
 * Fetches clinic data from the backend API and renders the header,
 * tab navigation, and the active tab's content.
 */
export default function ClinicDetailLayout({ children }: ClinicLayoutProps) {
  const params = useParams();
  const clinicId = params.id as string;
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClinicById(clinicId)
      .then(setClinic)
      .catch((err) => setError(err.message));
  }, [clinicId]);

  if (error) {
    return <p style={{ padding: '24px', color: '#dc2626' }}>Clinic not found</p>;
  }

  if (!clinic) {
    return <p style={{ padding: '24px', color: '#6b7280' }}>Loading clinic...</p>;
  }

  const status = clinic.isActive ? 'active' : 'inactive';

  return (
    <div>
      <ClinicDetailHeader name={clinic.name} status={status} />
      <ClinicDetailTabs clinicId={clinicId} />
      {children}
    </div>
  );
}
