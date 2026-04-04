'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clinic } from '@/types/clinic';
import { getClinics, deactivateClinic, activateClinic } from '@/lib/api/clinics';
import { useDebounce } from '@/hooks/useDebounce';
import ClinicsHeader from '@/components/clinics/ClinicsHeader';
import ClinicCard from '@/components/clinics/ClinicCard';
import EmptyState from '@/components/clinics/EmptyState';
import styles from './ClinicsPage.module.css';

/**
 * Clinics list page – displays all clinics in a responsive grid
 * with real-time search filtering and activate/deactivate actions.
 * Active clinics appear first, inactive ones at the bottom.
 */
export default function ClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Debounce the raw search input to avoid excessive API calls
  const debouncedSearch = useDebounce(searchTerm, 300);

  /** Fetches clinics from the API, optionally filtered by search term. */
  const fetchClinics = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const data = await getClinics(search);
      // Sort: active clinics first, inactive at the bottom
      data.sort((a, b) => Number(b.isActive) - Number(a.isActive));
      setClinics(data);
    } catch (err) {
      console.error('Error fetching clinics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the debounced search term changes
  useEffect(() => {
    fetchClinics(debouncedSearch || undefined);
  }, [debouncedSearch, fetchClinics]);

  /**
   * Toggles a clinic's active status and refreshes the list.
   * @param id - clinic identifier
   * @param activate - true to activate, false to deactivate
   */
  const handleToggleStatus = async (id: string, activate: boolean) => {
    try {
      if (activate) {
        await activateClinic(id);
      } else {
        await deactivateClinic(id);
      }
      await fetchClinics(debouncedSearch || undefined);
    } catch (err) {
      console.error('Error toggling clinic status:', err);
    }
  };

  return (
    <div>
      <ClinicsHeader searchTerm={searchTerm} onSearchChange={setSearchTerm} />

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
