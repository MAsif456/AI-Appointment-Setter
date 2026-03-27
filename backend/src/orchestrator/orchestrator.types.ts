/**
 * Shared types, interfaces, and module-level constants for the orchestrator.
 * Imported by all orchestrator files to avoid circular dependencies.
 */

/** Fallback message used when AI generation fails or the Groq service is unavailable. */
export const FALLBACK_MESSAGE =
  "Thanks for your message! Someone from the clinic will be in touch shortly.";

/** UK postcode pattern — matches both spaced (CF10 1AA) and unspaced (CF101AA) variants. */
export const POSTCODE_REGEX = /[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i;

/** Keywords that indicate a lead wants to book an appointment. */
export const BOOKING_KEYWORDS = ['book', 'appointment', 'schedule', 'sign me up', 'yes please'];

/** Keywords that indicate a lead wants to cancel their appointment. */
export const CANCEL_KEYWORDS = [
  'cancel', "can't come", "can't make it", "won't be able",
  'cancel my booking', 'cancel my appointment',
];

/** Keywords that confirm a pending action (cancellation confirmation). */
export const CONFIRM_KEYWORDS = [
  'yes', 'correct', 'confirm', 'go ahead', 'please cancel', 'yeah', 'yep', 'sure',
];

/** Keywords that decline a pending cancellation or indicate rescheduling preference. */
export const DECLINE_CANCEL_KEYWORDS = [
  'no', 'never mind', 'keep it', "don't cancel", 'reschedule', 'rebook', "i'll reschedule",
];

/** Default SMS message type used for ContactCreate events where no channel is known. */
export const DEFAULT_MESSAGE_TYPE = 'SMS';

/** A single message entry used to build conversation history for AI prompts. */
export interface OrchestratorMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

/**
 * Conversation context assembled from live database state.
 * Passed to generateResponse so prompts can include real history and phase.
 */
export interface OrchestratorContext {
  ghlContactId?: string;
  clinicId: string;
  phase: string;
  messages: OrchestratorMessage[];
  patientInfo: {
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    issue?: string;
  };
}

/** Discriminated union of all possible detected intents. */
export type IntentResult =
  | { intent: 'PROVIDE_POSTCODE'; data: { postcode: string } }
  | { intent: 'WANT_TO_BOOK' }
  | { intent: 'CANCEL' }
  | { intent: 'CONFIRM_CANCEL' }
  | { intent: 'DECLINE_CANCEL' }
  | { intent: 'UNKNOWN' };
