'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Clinic } from '@/types/clinic';
import { getClinicById } from '@/lib/api/clinics';
import { useAuth } from '@/contexts/AuthContext';
import ClinicDetailTabs from '@/components/clinics/ClinicDetailTabs';
import styles from './ClinicDetail.module.css';

/**
 * Clinic detail page – shows the clinic name, status badge,
 * and tabbed sections (Overview, Settings, AI Configuration, etc.).
 */
export default function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
  
    // Block staff from accessing clinics they are not assigned to
    if (!isAdmin && !user?.assignedClinics?.includes(id)) {
      router.replace('/clinics');
      return;
    }

    getClinicById(id)
      .then(setClinic)
      .catch((err) => console.error('Error fetching clinic:', err))
      .finally(() => setLoading(false));
  }, [id, isAdmin, user?.assignedClinics, router]);

  if (loading) {
    return <p className={styles.loading}>Loading clinic...</p>;
  }

  if (!clinic) {
    return (
      <div className={styles.notFound}>
        <p>Clinic not found.</p>
        <Link href="/clinics" className={styles.backLink}>
          Back to Clinics
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link href="/clinics" className={styles.backLink}>
        ← Back to Clinics
      </Link>

      {/* Heading with status badge */}
      <div className={styles.heading}>
        <h1 className={styles.clinicName}>{clinic.name}</h1>
        <span className={clinic.isActive ? styles.badgeActive : styles.badgeInactive}>
          {clinic.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <ClinicDetailTabs
        clinic={clinic}
        onClinicUpdated={(updated) => setClinic(updated)}
      />
    </div>
  );
}
