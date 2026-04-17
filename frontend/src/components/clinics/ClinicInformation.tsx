'use client';

import type { Clinic } from '@/types/clinic';
import styles from './ClinicInformation.module.css';

interface ClinicInformationProps {
  /** The clinic whose information we are displaying. */
  clinic: Clinic;
}

/** Ordered list of days so the business-hours grid always reads Mon → Sun. */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Picks the business-hours row for a given day, case-insensitively. */
function findHours(clinic: Clinic, day: string) {
  return (clinic.businessHours ?? []).find(
    (h) => String(h.day).toLowerCase() === day.toLowerCase(),
  );
}

/**
 * Read-only "Clinic Information" block on the Overview tab.
 *
 * Groups the static clinic metadata the staff need at-a-glance:
 * address + phone, service areas, services offered, and weekly
 * business hours. Kept intentionally separate from the settings
 * form so this block can be rendered without any edit affordance.
 */
export default function ClinicInformation({ clinic }: ClinicInformationProps) {
  const serviceAreaPrefixes = (clinic.serviceAreas ?? []).map((a) => a.postcodePrefix);
  const services = clinic.services ?? [];

  return (
    <section className={styles.card} aria-labelledby="clinic-info-heading">
      <h2 id="clinic-info-heading" className={styles.heading}>Clinic Information</h2>

      <div className={styles.grid}>
        <div>
          <p className={styles.label}>Address</p>
          <p className={styles.value}>{clinic.address || '—'}</p>
        </div>
        <div>
          <p className={styles.label}>Phone</p>
          <p className={styles.value}>{clinic.phone || '—'}</p>
        </div>

        <div>
          <p className={styles.label}>Service Areas</p>
          <div className={styles.pillRow}>
            {serviceAreaPrefixes.length === 0 ? (
              <span className={styles.subtle}>No service areas configured</span>
            ) : (
              serviceAreaPrefixes.map((p) => (
                <span key={p} className={styles.pill}>{p}</span>
              ))
            )}
          </div>
        </div>

        <div>
          <p className={styles.label}>Services Offered</p>
          <div className={styles.pillRow}>
            {services.length === 0 ? (
              <span className={styles.subtle}>No services configured</span>
            ) : (
              services.map((s) => (
                <span key={s.name} className={styles.pill}>{s.name}</span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={styles.hoursWrapper}>
        <p className={styles.label}>Business Hours</p>
        <dl className={styles.hoursGrid}>
          {DAYS.map((day) => {
            const row = findHours(clinic, day);
            const isOpen = row?.isOpen ?? false;
            return (
              <div key={day} className={styles.hoursRow}>
                <dt className={styles.dayName}>{day}</dt>
                <dd className={styles.dayValue}>
                  {isOpen && row?.openTime && row?.closeTime
                    ? `${row.openTime} - ${row.closeTime}`
                    : 'Closed'}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
