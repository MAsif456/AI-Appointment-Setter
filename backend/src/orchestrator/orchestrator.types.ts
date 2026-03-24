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

/** Static response returned when a message looks like a postcode but is not a valid UK format. */
export const INVALID_POSTCODE_RESPONSE =
  "That doesn't look like a UK postcode. Could you double-check and send it again?";

/** Discriminated union of all possible detected intents. */
export type IntentResult =
  | { intent: 'PROVIDE_POSTCODE'; data: { postcode: string } }
  | { intent: 'INVALID_POSTCODE_FORMAT' }
  | { intent: 'WANT_TO_BOOK' }
  | { intent: 'UNKNOWN' };
