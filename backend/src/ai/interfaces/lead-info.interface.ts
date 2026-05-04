/**
 * Represents lead data extracted from a GHL webhook or MongoDB.
 * Contains the patient's personal details and inquiry information.
 */
export interface LeadInfo {
  /** Lead's first name */
  firstName: string;

  /** Lead's last name (optional) */
  lastName?: string;

  /** Lead's email address */
  email?: string;

  /** Lead's phone number */
  phone?: string;

  /** The health issue or concern, e.g. "Back pain for 2 weeks" */
  issue?: string;

  /** How the lead found the clinic, e.g. "Facebook Ads", "Google" */
  leadSource?: string;

  /** GoHighLevel contact ID */
  contactId?: string;

  /** Postcode already validated in a previous or current conversation */
  validatedPostcode?: string;

  /** Whether this lead has a prior booking history at this clinic */
  isReturningPatient?: boolean;

  /** Whether the returning patient just provided a new postcode (details changed flow) */
  detailsJustUpdated?: boolean;
}
