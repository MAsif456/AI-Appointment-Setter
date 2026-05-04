/**
 * ClinicList: simple list of links to each clinic's detail page.
 */
import Link from "next/link";
import styles from "./clinics.module.css";
import type { Clinic } from "./types";

type Props = {
  clinics: Clinic[];
};

export default function ClinicList({ clinics }: Props) {
  return (
    <div>
      <div className={styles.pageActions}>
        <h1>Clinics</h1>
        <Link href="/clinics/new" className={styles.primaryButton}>+ Add Clinic</Link>
      </div>

      {clinics.length === 0 ? (
        <p>No clinics found.</p>
      ) : (
        <ul>
          {clinics.map((clinic) => (
            <li key={clinic._id}>
              <Link href={`/clinics?clinicId=${clinic._id}`} className={styles.viewDetailsLink}>
                {clinic.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

