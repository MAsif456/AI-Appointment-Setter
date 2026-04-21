import { useState } from 'react';
import styles from './integrations.module.css';

/** Required GHL API scopes displayed as a collapsible list. */
const REQUIRED_SCOPES = [
  'conversations.readonly',
  'conversations.write',
  'conversations/message.write',
  'conversations/message.readonly',
  'calendars.readonly',
  'calendars.write',
  'calendars/events.write',
  'calendars/events.readonly',
  'calendars/groups.readonly',
  'calendars/groups.write',
  'calendars/resources.readonly',
  'calendars/resources.write',
  'contacts.readonly',
  'contacts.write',
  'locations.readonly',
  'locations/customFields.readonly',
  'locations/customFields.write',
  'locations/customValues.readonly',
  'locations/customValues.write',
  'socialplanner/oauth.readonly',
  'socialplanner/oauth.write',
] as const;

/** Collapsible toggle showing the required API scopes for GHL integration. */
export default function ApiScopesList() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.scopesToggle} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Required API scopes
      </button>
      {open && (
        <ul className={styles.scopesList}>
          {REQUIRED_SCOPES.map((scope) => (
            <li key={scope}>{scope}</li>
          ))}
        </ul>
      )}
    </>
  );
}
