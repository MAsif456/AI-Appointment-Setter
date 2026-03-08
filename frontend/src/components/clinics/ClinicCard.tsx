'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Clinic } from '@/types/clinic';
import styles from './ClinicCard.module.css';

/** Props accepted by the ClinicCard component. */
interface ClinicCardProps {
  clinic: Clinic;
  onToggleStatus: (id: string, activate: boolean) => void;
}

/**
 * Displays a single clinic as a card with name, address, service area tags,
 * lead/booking stats, status badge, and a three-dot action menu.
 */
export default function ClinicCard({ clinic, onToggleStatus }: ClinicCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.card}>
      {/* Header: clinic name + three-dot menu */}
      <div className={styles.cardHeader}>
        <h3 className={styles.clinicName}>{clinic.name}</h3>
        <div ref={menuRef} className={styles.menuWrapper}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className={styles.menuButton}
            aria-label="Clinic actions"
          >
            &#8942;
          </button>

          {menuOpen && (
            <div className={styles.dropdown}>
              <Link href={`/clinics/${clinic._id}/edit`} className={styles.dropdownItem}>
                Edit
              </Link>
              <button
                onClick={() => {
                  onToggleStatus(clinic._id, !clinic.isActive);
                  setMenuOpen(false);
                }}
                className={styles.dropdownItem}
              >
                {clinic.isActive ? 'Deactivate Clinic' : 'Activate Clinic'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      <p className={styles.address}>{clinic.address}</p>

      {/* Service area tags */}      <div className={styles.tags}>
        {(clinic.serviceAreas ?? []).map((area) => (
          <span key={area.postcodePrefix} className={styles.tag}>{area.postcodePrefix}</span>
        ))}
      </div>      {/* Stats */}
      <p className={styles.stats}>
        <span className={styles.statNumber}>{clinic.todayLeadsCount}</span> leads
        {' · '}
        <span className={styles.statNumber}>{clinic.todayBookingsCount}</span> bookings
      </p>

      {/* Footer: status badge + view details link */}
      <div className={styles.cardFooter}>
        <span className={clinic.isActive ? styles.badgeActive : styles.badgeInactive}>
          {clinic.isActive ? 'Active' : 'Inactive'}
        </span>
        <Link href={`/clinics/${clinic._id}`} className={styles.viewDetails}>
          View details →
        </Link>
      </div>
    </div>
  );
}
