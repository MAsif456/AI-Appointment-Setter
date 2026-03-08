import { forwardRef, useState } from "react";
import styles from "./clinics.module.css";
import type { Clinic } from "./types";
import BusinessHoursEditor from "./BusinessHoursEditor";

type Props = {
  clinic: Clinic;
  onSave: (clinic: Clinic) => Promise<void>;
};

const ClinicSettingsForm = forwardRef<HTMLFormElement, Props>(
  function ClinicSettingsForm({ clinic, onSave }, ref) {
    // state
    const [draft, setDraft] = useState<Clinic>(clinic);
    const [newArea, setNewArea] = useState("");

    // service area helpers: normalise codes into ServiceArea objects and patch draft
    const updateServiceAreas = (codes: string[]) => {
      setDraft((prev) => ({
        ...prev,
        serviceAreas: codes.map((code) => ({
          postcodePrefix: code,
          description:
            prev.serviceAreas.find((s) => s.postcodePrefix === code)?.description,
        })),
      }));
    };

    const handleAddServiceArea = (code: string) => {
      const trimmed = code.toUpperCase().trim();
      if (!trimmed) return;
      if (draft.serviceAreas.some((s) => s.postcodePrefix === trimmed)) return;
      updateServiceAreas([
        ...draft.serviceAreas.map((s) => s.postcodePrefix),
        trimmed,
      ]);
    };

    const handleRemoveServiceArea = (code: string) => {
      updateServiceAreas(
        draft.serviceAreas
          .map((s) => s.postcodePrefix)
          .filter((c) => c !== code)
      );
    };

    // submit: delegates to onSave so the PATCH lives in ClinicDetail
    const handleSubmit = async (event: React.FormEvent) => {
      event.preventDefault();
      await onSave(draft);
    };

    return (
      <form
        ref={ref}
        className={styles.settingsForm}
        onSubmit={handleSubmit}
      >
        <div className={styles.settingsCard}>
          <h2 className={styles.settingsCardTitle}>Basic Information</h2>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="clinic-name">
              Clinic Name
            </label>
            <input
              id="clinic-name"
              className={styles.textInput}
              value={draft.name}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="clinic-address">
              Address
            </label>
            <input
              id="clinic-address"
              className={styles.textInput}
              value={draft.address ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, address: e.target.value }))
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="clinic-phone">
              Phone Number
            </label>
            <input
              id="clinic-phone"
              className={styles.textInput}
              value={draft.phone ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="clinic-ghl">
              GHL Location ID
            </label>
            <input
              id="clinic-ghl"
              className={styles.textInput}
              value={draft.ghlLocationId ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  ghlLocationId: e.target.value || undefined,
                }))
              }
            />
          </div>
        </div>

        <div className={styles.settingsCard}>
          <h2 className={styles.settingsCardTitle}>Service areas</h2>
          <div className={styles.chipsRow}>
            {draft.serviceAreas.map((area) => (
              <span key={area.postcodePrefix} className={styles.chip}>
                {area.postcodePrefix}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => handleRemoveServiceArea(area.postcodePrefix)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className={styles.pageActions}>
            <input
              type="text"
              placeholder="Add postcode prefix (e.g. BA)"
              className={styles.textInput}
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
            />
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                handleAddServiceArea(newArea);
                setNewArea("");
              }}
            >
              Add area
            </button>
          </div>
        </div>

        <div className={styles.settingsCard}>
          <h2 className={styles.settingsCardTitle}>Business Hours</h2>
          <BusinessHoursEditor
            value={draft.businessHours}
            onChange={(hours) =>
              setDraft((prev) => ({ ...prev, businessHours: hours }))
            }
          />
        </div>

      </form>
    );
  }
);

export default ClinicSettingsForm;
