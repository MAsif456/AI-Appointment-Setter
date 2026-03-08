'use client';

import { useRef, useState } from "react";
import styles from "./clinics.module.css";
import type { Clinic } from "./types";
import ClinicDetailHeader from "./ClinicDetailHeader";
import ClinicSettingsForm from "./ClinicSettingsForm";
import ClinicSettingsView from "./ClinicSettingsView";

type TabKey = "overview" | "settings" | "ai" | "conversations" | "analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Props = {
  initialClinic: Clinic;
};

export default function ClinicDetail({ initialClinic }: Props) {
  // state
  const [activeTab, setActiveTab] = useState<TabKey>("settings");
  const [clinic, setClinic] = useState<Clinic>(initialClinic);
  const [isSettingsEditing, setIsSettingsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settingsFormRef = useRef<HTMLFormElement>(null);

  // PATCHes /clinics/:id/settings; updates local state and feedback banner on success
  const handleSaveSettings = async (updated: Clinic) => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        name: updated.name,
        address: updated.address,
        phone: updated.phone,
        ghlLocationId: updated.ghlLocationId,
        serviceAreas: updated.serviceAreas,
        businessHours: updated.businessHours,
      };

      const res = await fetch(`${API_URL}/clinics/${clinic._id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update settings");
      }

      const saved = (await res.json()) as Clinic;
      setClinic(saved);
      setSuccessMessage("Settings updated");
      setIsSettingsEditing(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong while saving."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.detailPage}>
      <ClinicDetailHeader
        clinicName={clinic.name}
        isActive={clinic.isActive}
        isEditing={isSettingsEditing}
        isSaving={isSaving}
        activeTab={activeTab}
        onEdit={() => setIsSettingsEditing(true)}
        onCancel={() => setIsSettingsEditing(false)}
        formRef={settingsFormRef}
      />

      {/* tab navigation */}
      <nav className={styles.tabs} aria-label="Clinic sections">
        {(
          [
            ["overview", "Overview"],
            ["settings", "Settings"],
            ["ai", "AI Configuration"],
            ["conversations", "Conversations"],
            ["analytics", "Analytics"],
          ] as [TabKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${styles.tabButton} ${
              activeTab === key ? styles.tabButtonActive : ""
            }`}
            onClick={() => {
              setActiveTab(key);
              if (key !== "settings") setIsSettingsEditing(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* feedback banners */}
      {successMessage && (
        <div className={styles.successBanner}>{successMessage}</div>
      )}
      {error && <p className={styles.errorText}>{error}</p>}

      {/* tab panels */}
      {activeTab === "overview" && (
        <section className={styles.tabPanel}>
          <p className={styles.detailMeta}>
            Clinic overview will be added here.
          </p>
        </section>
      )}

      {activeTab === "settings" && !isSettingsEditing && (
        <ClinicSettingsView clinic={clinic} />
      )}
      {activeTab === "settings" && isSettingsEditing && (
        <section className={styles.tabPanel}>
          <ClinicSettingsForm
            ref={settingsFormRef}
            clinic={clinic}
            onSave={handleSaveSettings}
          />
        </section>
      )}

      {activeTab === "ai" && (
        <section className={styles.tabPanel}>
          <p className={styles.detailMeta}>
            AI configuration UI will be added here.
          </p>
        </section>
      )}

      {activeTab === "conversations" && (
        <section className={styles.tabPanel}>
          <p className={styles.detailMeta}>
            Recent conversations for this clinic will appear here.
          </p>
        </section>
      )}

      {activeTab === "analytics" && (
        <section className={styles.tabPanel}>
          <p className={styles.detailMeta}>
            Conversion and performance analytics will appear here.
          </p>
        </section>
      )}
    </div>
  );
}
