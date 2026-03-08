'use client';

import { useState } from 'react';
import styles from './ServicesLocations.module.css';
import { ServicesAndLocations } from '@/types/clinic';
import { CloseIcon } from '../Icons';

/** Props for the ServicesLocations component. */
interface ServicesLocationsProps {
  value: ServicesAndLocations;
  onChange: (services: ServicesAndLocations) => void;
}

/**
 * Displays and manages the clinic's offered services and
 * postcode prefix service areas as removable tag chips.
 * New items can be added via inline text inputs.
 */
export default function ServicesLocations({ value, onChange }: ServicesLocationsProps) {
  const [newService, setNewService] = useState('');
  const [newPrefix, setNewPrefix] = useState('');

  /** Adds a service to the list if it's not already present. */
  const addService = () => {
    const trimmed = newService.trim();
    if (trimmed && !value.servicesOffered.includes(trimmed)) {
      onChange({ ...value, servicesOffered: [...value.servicesOffered, trimmed] });
      setNewService('');
    }
  };

  /** Removes a service by its value. */
  const removeService = (service: string) => {
    onChange({ ...value, servicesOffered: value.servicesOffered.filter((s) => s !== service) });
  };

  /** Adds a postcode prefix (uppercased) if not already present. */
  const addPrefix = () => {
    const trimmed = newPrefix.trim().toUpperCase();
    if (trimmed && !value.serviceAreaPrefixes.includes(trimmed)) {
      onChange({ ...value, serviceAreaPrefixes: [...value.serviceAreaPrefixes, trimmed] });
      setNewPrefix('');
    }
  };

  /** Removes a postcode prefix by its value. */
  const removePrefix = (prefix: string) => {
    onChange({ ...value, serviceAreaPrefixes: value.serviceAreaPrefixes.filter((p) => p !== prefix) });
  };

  /** Handles Enter key to submit new items. */
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Services &amp; Locations</h2>

      {/* Services offered */}
      <div className={styles.subsection}>
        <h3 className={styles.subsectionTitle}>Services Offered</h3>
        <div className={styles.tags}>
          {value.servicesOffered.map((service) => (
            <span key={service} className={styles.tag}>
              {service}
              <button
                className={styles.tagRemove}
                onClick={() => removeService(service)}
                aria-label={`Remove ${service}`}
              >
                <CloseIcon className={styles.tagRemoveIcon} />
              </button>
            </span>
          ))}
        </div>
        <div className={styles.addRow}>
          <input
            type="text"
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, addService)}
            placeholder="Add a service..."
            className={styles.addInput}
          />
          <button onClick={addService} className={styles.addButton}>Add</button>
        </div>
      </div>

      {/* Service area prefixes */}
      <div className={styles.subsection}>
        <h3 className={styles.subsectionTitle}>Service Areas (Postcode Prefixes)</h3>
        <div className={styles.tags}>
          {value.serviceAreaPrefixes.map((prefix) => (
            <span key={prefix} className={`${styles.tag} ${styles.prefixTag}`}>
              {prefix}
              <button
                className={styles.tagRemove}
                onClick={() => removePrefix(prefix)}
                aria-label={`Remove ${prefix}`}
              >
                <CloseIcon className={styles.tagRemoveIcon} />
              </button>
            </span>
          ))}
        </div>
        <div className={styles.addRow}>
          <input
            type="text"
            value={newPrefix}
            onChange={(e) => setNewPrefix(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, addPrefix)}
            placeholder="Add a postcode prefix..."
            className={styles.addInput}
          />
          <button onClick={addPrefix} className={styles.addButton}>Add</button>
        </div>
        <p className={styles.hint}>
          These postcode prefixes determine which areas your clinic serves.
        </p>
      </div>
    </section>
  );
}
