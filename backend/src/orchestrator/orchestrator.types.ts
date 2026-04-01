/**
 * Shared types, interfaces, and module-level constants for the orchestrator.
 * Imported by all orchestrator files to avoid circular dependencies.
 */

/** Fallback message used when AI generation fails or the Groq service is unavailable. */
export const FALLBACK_MESSAGE =
  "Thanks for your message! Someone from the clinic will be in touch shortly.";

/**
 * UK postcode pattern — matches both spaced (CF10 1AA) and unspaced (CF101AA) variants.
 * Word boundaries prevent partial matches inside longer strings, so "CF10 1AAA" does NOT match.
 */
export const POSTCODE_REGEX = /\b[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}\b/i;

/** Keywords that indicate a lead wants to book an appointment. */
export const BOOKING_KEYWORDS = ['book', 'appointment', 'schedule', 'sign me up', 'yes please'];

/** Default SMS message type used for ContactCreate events where no channel is known. */
export const DEFAULT_MESSAGE_TYPE = 'SMS';

/** Phrases that indicate a lead in the "booked" phase wants to reschedule. */
export const RESCHEDULE_KEYWORDS = [
  'reschedule', 'rearrange', 'change my appointment', 'change my booking',
  'change the date', 'change the time', 'move my booking', 'move my appointment',
  'different day', 'different time', "can't make it", "can't make",
  'unable to make it', 'need to change', 'switch my appointment',
  'is it possible to reschedule',
  // post-reschedule "want original back" phrases
  'go back to my original', 'original appointment', 'original date',
  'undo the reschedule', 'undo my reschedule', 'revert',
];

/** Phrases that indicate a lead in "rescheduling" phase wants to abandon the reschedule. */
export const CANCEL_RESCHEDULE_KEYWORDS = [
  'never mind', 'forget it', 'keep my original', 'keep my appointment',
  "actually it's fine", 'actually its fine',
];

/** Static response when RESCHEDULE is detected but no appointment is on file. */
export const NO_APPOINTMENT_RESPONSE =
  "I don't have a booking on file for you. Would you like to book an appointment?";

/** Static response returned when a message looks like a postcode but is not a valid UK format. */
export const INVALID_POSTCODE_RESPONSE =
  "That doesn't look like a UK postcode. Could you double-check and send it again?";

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
  /** Populated when phase is 'booked' or 'rescheduling' and an appointment exists. */
  currentAppointment?: {
    ghlAppointmentId: string;
    appointmentDate: string;
    appointmentTime: string;
  };
}

/** Discriminated union of all possible detected intents. */
export type IntentResult =
  | { intent: 'PROVIDE_POSTCODE'; data: { postcode: string } }
  | { intent: 'INVALID_POSTCODE_FORMAT' }
  | { intent: 'WANT_TO_BOOK' }
  | { intent: 'RESCHEDULE' }
  | { intent: 'CANCEL_RESCHEDULE' }
  | { intent: 'UNKNOWN' };
