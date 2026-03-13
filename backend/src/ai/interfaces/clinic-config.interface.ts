/**
 * Represents per-clinic configuration from MongoDB.
 * Controls AI behaviour, tone, and greeting templates for a specific clinic.
 */
export interface ClinicConfig {
  /** Unique clinic identifier */
  clinicId: string;

  /** Display name of the clinic, e.g. "Cardiff Chiropractic" */
  name: string;

  /** AI conversation tone setting */
  tone: 'Friendly' | 'Professional';

  /** Optional custom greeting template with {{placeholder}} variables */
  greetingTemplate?: string;

  /** Postcode prefixes the clinic serves, e.g. ["CF", "NP"] */
  serviceAreas?: string[];

  /** Additional instructions for the AI, e.g. "Always mention free parking" */
  customInstructions?: string;

  /** GoHighLevel location identifier */
  ghlLocationId: string;

  /** Whether the clinic is currently active */
  isActive: boolean;
}
