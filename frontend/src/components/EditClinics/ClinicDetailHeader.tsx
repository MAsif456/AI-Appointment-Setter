'use client';

import Link from "next/link";
import styles from "./clinics.module.css";

type Props = {
  clinicName: string;
  isActive: boolean;
  isEditing: boolean;
  isSaving: boolean;
  activeTab: string;
  onEdit: () => void;
  onCancel: () => void;
  formRef: React.RefObject<HTMLFormElement | null>;
};

export default function ClinicDetailHeader({
  clinicName,
  isActive,
  isEditing,
  isSaving,
  activeTab,
  onEdit,
  onCancel,
  formRef,
}: Props) {
  return (
    <header className={styles.detailHeader}>
      <div>
        <Link href="/clinics" className={styles.viewDetailsLink}>
          &larr; Back to Clinics
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.detailTitle}>{clinicName}</h1>
          <span
            className={
              isActive ? styles.statusBadgeActive : styles.statusBadgeInactive
            }
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className={styles.headerActions}>
        {activeTab === "settings" && !isEditing && (
          <button
            type="button"
            className={styles.editButton}
            onClick={onEdit}
            aria-label="Edit settings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
        )}
        {activeTab === "settings" && isEditing && (
          <>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => formRef.current?.requestSubmit()}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </>
        )}
        <button
          type="button"
          className={styles.menuButton}
          aria-label="More options"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>
    </header>
  );
}
