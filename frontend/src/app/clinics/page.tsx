'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clinic } from '@/types/clinic';
import { getClinics, deactivateClinic, activateClinic } from '@/lib/api/clinics';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/contexts/AuthContext';
import ClinicsHeader from '@/components/clinics/ClinicsHeader';
import ClinicCard from '@/components/clinics/ClinicCard';
import EmptyState from '@/components/clinics/EmptyState';
import styles from './ClinicsPage.module.css';

/**
 * Clinics list page.
 * Admins see all clinics and can add new ones.
 * Staff see only their assigned clinics and cannot add new ones.
 * The Add Clinic button is passed into ClinicsHeader so it can be hidden for staff.
 */
export default function ClinicsPage() {
  const { user, isAdmin } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const fetchClinics = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const data = await getClinics(search);

      /**
       * Filter clinics for staff: only show clinics whose _id appears
       * in the user's assignedClinics array (stored as strings in the JWT).
       * Admins skip this filter and see everything.
       */
      const filtered = isAdmin
        ? data
        : data.filter(clinic => user?.assignedClinics?.includes(clinic._id));

      filtered.sort((a, b) => Number(b.isActive) - Number(a.isActive));
      setClinics(filtered);
    } catch (err) {
      console.error('Error fetching clinics:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.assignedClinics]);

  useEffect(() => {
    fetchClinics(debouncedSearch || undefined);
  }, [debouncedSearch, fetchClinics]);

  const handleToggleStatus = async (id: string, activate: boolean) => {
    try {
      activate ? await activateClinic(id) : await deactivateClinic(id);
      await fetchClinics(debouncedSearch || undefined);
    } catch (err) {
      console.error('Error toggling clinic status:', err);
    }
  };

  return (
    <div>
      {/*
        Pass isAdmin to ClinicsHeader so it can show/hide the Add Clinic button.
        If your ClinicsHeader doesn't yet accept this prop, see the note below.
      */}
      <ClinicsHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        showAddButton={isAdmin}
      />

      {loading ? (
        <p className={styles.loadingText}>Loading clinics...</p>
      ) : clinics.length === 0 ? (
        <EmptyState hasSearch={searchTerm.length > 0} />
      ) : (
        <div className={styles.grid}>
          {clinics.map((clinic) => (
            <ClinicCard
              key={clinic._id}
              clinic={clinic}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}