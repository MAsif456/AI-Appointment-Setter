import styles from "./clinics.module.css";
import type { Clinic } from "./types";
import { DAYS_ORDER, capitalizeDay } from "./utils";

type Props = {
  clinic: Clinic;
};

export default function ClinicOverview({ clinic }: Props) {
  const hoursByDay = new Map((clinic.businessHours ?? []).map((h) => [h.day, h]));
  const sortedBusinessHours = DAYS_ORDER.flatMap((day) => {
    const row = hoursByDay.get(day);
    return row ? [row] : [];
  });

  return (
    <section className={styles.tabPanel}>
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>This Month&apos;s Leads</div>
          <div className={styles.metricValue}>{clinic.monthLeadsCount}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>This Month&apos;s Bookings</div>
          <div className={styles.metricValue}>{clinic.monthBookingsCount}</div>
        </div>
      </div>

      <div>
        <h2 className={styles.sectionTitle}>Clinic Information</h2>
        <p className={styles.detailMeta}>
          {clinic.address}
          <br />
          {clinic.email}
        </p>
        <div className={styles.chipsRow}>
          {clinic.serviceAreas.map((area) => (
            <span key={area.postcodePrefix} className={styles.chip}>
              {area.postcodePrefix}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h2 className={styles.sectionTitle}>Business Hours</h2>
        <table className={styles.hoursTable}>
          <thead>
            <tr>
              <th>Day</th>
              <th>Status</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {sortedBusinessHours.map((row) => (
              <tr key={row.day}>
                <td>{capitalizeDay(row.day)}</td>
                <td>{row.isOpen ? "Open" : "Closed"}</td>
                <td>
                  {row.isOpen
                    ? `${row.openTime ?? "--:--"} - ${row.closeTime ?? "--:--"}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

