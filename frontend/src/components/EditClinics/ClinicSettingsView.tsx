import styles from "./clinics.module.css";
import type { Clinic } from "./types";
import { DAYS_ORDER, capitalizeDay } from "./utils";

type Props = {
  clinic: Clinic;
};

export default function ClinicSettingsView({ clinic }: Props) {
  const hoursByDay = new Map(
    (clinic.businessHours ?? []).map((h) => [h.day, h])
  );

  return (
    <section className={styles.tabPanel}>
      <div className={styles.settingsCard}>
        <h2 className={styles.settingsCardTitle}>Basic Information</h2>
        <div className={styles.readOnlyField}>
          <span className={styles.readOnlyLabel}>Clinic Name</span>
          <span className={styles.readOnlyValue}>{clinic.name || "—"}</span>
        </div>
        <div className={styles.readOnlyField}>
          <span className={styles.readOnlyLabel}>Address</span>
          <span className={styles.readOnlyValue}>{clinic.address || "—"}</span>
        </div>
        <div className={styles.readOnlyField}>
          <span className={styles.readOnlyLabel}>Phone Number</span>
          <span className={styles.readOnlyValue}>{clinic.phone || "—"}</span>
        </div>
        <div className={styles.readOnlyField}>
          <span className={styles.readOnlyLabel}>GHL Location ID</span>
          <span className={styles.readOnlyValue}>
            {clinic.ghlLocationId || "—"}
          </span>
        </div>
      </div>

      <div className={styles.settingsCard}>
        <h2 className={styles.settingsCardTitle}>Business Hours</h2>
        {DAYS_ORDER.map((day) => {
          const row = hoursByDay.get(day);
          const isOpen = row?.isOpen ?? false;
          return (
            <div key={day} className={styles.readOnlyHoursRow}>
              <span className={styles.readOnlyHoursLabel}>
                {capitalizeDay(day)}
              </span>
              {isOpen && row ? (
                <div className={styles.readOnlyHoursBoxes}>
                  <span className={styles.readOnlyHoursSingle}>
                    {row.openTime ?? "—"}
                  </span>
                  <span className={styles.readOnlyHoursDivider}>–</span>
                  <span className={styles.readOnlyHoursSingle}>
                    {row.closeTime ?? "—"}
                  </span>
                </div>
              ) : (
                <span className={styles.readOnlyHoursClosed}>Closed</span>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.settingsCard}>
        <div className={styles.statusRow}>
          <div>
            <div className={styles.statusLabel}>Clinic Status</div>
            <p className={styles.statusMessage}>
              {clinic.isActive
                ? "This clinic is currently accepting appointments"
                : "This clinic is not currently accepting appointments"}
            </p>
          </div>
          <span
            className={
              clinic.isActive
                ? styles.statusBadgeActive
                : styles.statusBadgeInactive
            }
          >
            {clinic.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
    </section>
  );
}
