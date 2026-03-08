'use client';

import Link from 'next/link';
import styles from './ClinicsHeader.module.css';

/** Props accepted by ClinicsHeader. */
interface ClinicsHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

/**
 * Renders the page title, search input, and "Add Clinic" button
 * at the top of the Clinics list page.
 */
export default function ClinicsHeader({ searchTerm, onSearchChange }: ClinicsHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>Clinics</h1>

      <div className={styles.actions}>
        {/* Search input with magnifying glass icon */}
        <div className={styles.searchWrapper}>
          <svg
            className={styles.searchIcon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search clinics..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={styles.searchInput}
          />
        </div>        {/* Add Clinic button – navigates to the new clinic form */}
        <Link href="/clinics/new" className={styles.addButton}>
          + Add Clinic
        </Link>
      </div>
    </div>
  );
}
