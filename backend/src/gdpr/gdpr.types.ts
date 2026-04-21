/**
 * GDPR compliance constants, keywords, and shared types.
 *
 * Consent statement wording follows ICO guidance on explicit consent
 * for special category (health) data under UK GDPR Article 9(2)(a).
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/
 */

/** Semantic version of the consent statement — stored in every ConsentRecord
 *  so compliance audits can trace which wording was shown. */
export const CONSENT_STATEMENT_VERSION = '1.0.0';

/** Full consent text presented to the patient.  Must be specific, informed,
 *  and unambiguous per ICO consent guidance. */
export const CONSENT_STATEMENT_TEXT =
  'To help book your appointment, we need to collect some personal information ' +
  'including your postcode and health concern. This data is stored securely, ' +
  'encrypted at rest, and used only for appointment booking purposes. You can ' +
  'request deletion of your data at any time. Do you consent to us collecting ' +
  'this information?';

/** Keywords indicating patient grants consent. Uses the same convention as
 *  orchestrator keyword lists: single-word = exact match, multi-word = substring. */
export const CONSENT_GRANTED_KEYWORDS = [
  'yes', 'sure', 'ok', 'okay', "that's fine", 'i agree', 'go ahead',
  'fine', 'alright', 'sounds good', 'happy to', 'no problem',
  'that is fine', 'agree', 'accepted', 'i consent',
  'actually i do', 'actually yes', 'changed my mind', 'i changed my mind',
  "i'm happy to", 'yeah', 'yep', 'yea', 'of course',
];

/** Keywords indicating patient declines consent. */
export const CONSENT_DECLINED_KEYWORDS = [
  'no', 'no thanks', "i don't want that", 'i dont want that',
  'decline', 'refuse', "i don't agree", 'i dont agree',
  "i'd rather not", 'id rather not', 'no thank you',
  "don't want to", 'dont want to', "i don't consent", 'i dont consent',
];

/** Sent after consent is granted — transitions to qualifying phase. */
export const CONSENT_ACKNOWLEDGED_RESPONSE =
  'Thank you for your consent. Your data will be stored securely and you can ' +
  'request its deletion at any time. Now, could you share your postcode so I ' +
  'can check we cover your area?';

/** Sent when consent is declined — conversation enters consent_declined phase. */
export const CONSENT_DECLINED_RESPONSE =
  "No problem at all. If you change your mind, feel free to get in touch. " +
  "We can't proceed with booking without your consent to process your information.";

/** Sent for any non-consent message while in consent_declined phase. */
export const CONSENT_DECLINED_FOLLOWUP =
  'We understand. If you change your mind about consenting, just let us know.';

/** Replacement value for anonymised PII fields during erasure.
 *  Anonymisation (not pseudonymisation) is used because AppointHealth has no
 *  legitimate purpose to re-identify patients after erasure — Recital 26
 *  places anonymised data outside GDPR scope entirely.
 *  Ref: ICO Anonymisation Guidance
 *    https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/what-is-personal-data/what-is-personal-data-about/ */
export const ANONYMISED_VALUE = '[REDACTED]';
