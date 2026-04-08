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
  tone: "Friendly" | "Professional";

  /** Optional custom greeting template with {{placeholder}} variables */
  greetingTemplate?: string;

  /** Optional greeting template for returning patients. Supports the same {{placeholder}} variables. */
  returningPatientGreetingTemplate?: string;

  /** Days before patient history is considered stale. Defaults to 365 if not set. */
  patientDataExpiryDays?: number;

  /** Postcode prefixes the clinic serves, e.g. ["CF", "NP"] */
  serviceAreas?: string[];

  /** Additional instructions for the AI, e.g. "Always mention free parking" */
  customInstructions?: string;

  /** GoHighLevel location identifier */
  ghlLocationId: string;

  /** Whether the clinic is currently active */
  isActive: boolean;

  /** Per-clinic cancellation policy settings */
  cancellationPolicy?: {
    feeEnabled: boolean;
    feeAmount?: number;
    feeDescription?: string;
    noticeHours: number;
    cancellationMessage?: string;
  };
}
