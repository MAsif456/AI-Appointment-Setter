/**
 * Default AI settings values used when a clinic has no saved configuration.
 * Centralises defaults so they stay consistent across seed data and API responses.
 */

/** Default qualification questions every clinic starts with. */
export const DEFAULT_QUALIFICATION_QUESTIONS = [
  { key: 'urgency', label: 'Urgency', enabled: true },
  { key: 'preferredTime', label: 'Preferred time of day', enabled: true },
  { key: 'painDescription', label: 'Pain description', enabled: true },
  { key: 'patientType', label: 'New or returning patient', enabled: true },
];

/** Default greeting template with placeholder variables. */
export const DEFAULT_GREETING_TEMPLATE =
  'Hi {{firstName}}! Thanks for getting in touch with {{clinicName}}. ' +
  'I can help you book an appointment. Let me ask a few quick questions.';

/** Default AI tone setting. */
export const DEFAULT_TONE = 'friendly';
