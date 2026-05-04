'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Clinic } from '@/types/clinic';
import { getClinicById } from '@/lib/api/clinics';
import { useAuth } from '@/contexts/AuthContext';
import ClinicDetailTabs, { type ClinicDetailTabsHandle } from '@/components/clinics/ClinicDetailTabs';
import styles from './ClinicDetail.module.css';

export default function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const tabsRef = useRef<ClinicDetailTabsHandle>(null);

  // Edit settings button only visible on Settings and AI Configuration tabs
  const showEditButton = activeTab === 'Settings' || activeTab === 'AI Configuration';

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setIsEditing(true);
    }
  }, [searchParams]);

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
      <Link href="/clinics" className={styles.backLink}>
        ← Back to Clinics
      </Link>

      <div className={styles.heading}>
        <div className={styles.headingLeft}>
          <h1 className={styles.clinicName}>{clinic.name}</h1>
          <span className={clinic.isActive ? styles.badgeActive : styles.badgeInactive}>
            {clinic.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        {isEditing ? (
          <div className={styles.editingActions}>
            <button className={styles.cancelButton} onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button className={styles.saveButton} onClick={() => tabsRef.current?.submitForm()}>
              Save Settings
            </button>
          </div>
        ) : showEditButton ? (
          <button className={styles.editButton} onClick={() => setIsEditing(true)}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Settings
          </button>
        ) : null}
      </div>

      <ClinicDetailTabs
        ref={tabsRef}
        clinic={clinic}
        onClinicUpdated={(updated) => setClinic(updated)}
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
