'use client';

import Link from 'next/link';
import styles from './ClinicDetailHeader.module.css';
import { BackArrowIcon, EditIcon, MoreVerticalIcon } from '../Icons';
import { ClinicStatus } from '@/types/clinic';

/** Props for the clinic detail header. */
interface ClinicDetailHeaderProps {
  name: string;
  status: ClinicStatus;
}

/**
 * Displays the clinic name, status badge, and action buttons
 * at the top of the clinic detail view. Includes a back link
 * to return to the clinics list.
 */
export default function ClinicDetailHeader({ name, status }: ClinicDetailHeaderProps) {
  return (
    <div className={styles.header}>
      {/* Back navigation */}
      <Link href="/clinics" className={styles.backLink}>
        <BackArrowIcon className={styles.backIcon} />
        Back to Clinics
      </Link>

      {/* Clinic name row with actions */}
      <div className={styles.titleRow}>
        <div className={styles.titleGroup}>
          <h1 className={styles.clinicName}>{name}</h1>
          <span className={`${styles.statusBadge} ${styles[status]}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>

        <div className={styles.actions}>
          <button className={styles.editButton}>
            <EditIcon className={styles.editIcon} />
            Edit
          </button>
          <button className={styles.moreButton} aria-label="More options">
            <MoreVerticalIcon className={styles.moreIcon} />
          </button>
        </div>
      </div>
    </div>
  );
}
