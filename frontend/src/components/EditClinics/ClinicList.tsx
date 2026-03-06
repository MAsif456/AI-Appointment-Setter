import Link from "next/link";
import styles from "./clinics.module.css";
import type { Clinic } from "./types";

type Props = {
  clinics: Clinic[];
};

export default function ClinicList({ clinics }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Clinics</h1>
          <p className={styles.pageSubtitle}>
            Manage all partner clinics, view performance, and update settings.
          </p>
        </div>
        <div className={styles.pageActions}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search clinics..."
            aria-label="Search clinics"
          />
          <button className={styles.primaryButton}>+ Add Clinic</button>
        </div>
      </header>

      <section className={styles.cardsGrid}>
        {clinics.map((clinic) => (
          <article key={clinic._id} className={styles.card}>
            <header className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{clinic.name}</h2>
              <span
                className={
                  clinic.isActive
                    ? styles.statusBadgeActive
                    : styles.statusBadgeInactive
                }
              >
                {clinic.isActive ? "Active" : "Inactive"}
              </span>
            </header>

            {clinic.address && (
              <p className={styles.cardAddress}>{clinic.address}</p>
            )}

            <div className={styles.serviceAreas}>
              {clinic.serviceAreas.map((area) => (
                <span
                  key={area.postcodePrefix}
                  className={styles.serviceAreaChip}
                >
                  {area.postcodePrefix}
                </span>
              ))}
            </div>

            <dl className={styles.statsRow}>
              <div>
                <dt className={styles.statLabel}>This month&apos;s leads</dt>
                <dd className={styles.statValue}>{clinic.monthLeadsCount}</dd>
              </div>
              <div>
                <dt className={styles.statLabel}>This month&apos;s bookings</dt>
                <dd className={styles.statValue}>{clinic.monthBookingsCount}</dd>
              </div>
            </dl>

            <footer className={styles.cardFooter}>
              <Link
                href={`/clinics?clinicId=${clinic._id}`}
                className={styles.viewDetailsLink}
              >
                View details &rarr;
              </Link>
            </footer>
          </article>
        ))}

        {clinics.length === 0 && (
          <p className={styles.emptyState}>
            No clinics found. Please add a clinic.
          </p>
        )}
      </section>
    </div>
  );
}

