/**
 * Shared types, interfaces, and module-level constants for the orchestrator.
 * Imported by all orchestrator files to avoid circular dependencies.
 */

/** Fallback when the Groq AI service is unavailable or returns an error. */
export const FALLBACK_AI_UNAVAILABLE =
  "Thanks for your message! Someone from the clinic will be in touch shortly.";

/** Backward-compatible alias so existing imports continue to work. */
export const FALLBACK_MESSAGE = FALLBACK_AI_UNAVAILABLE;

/** Fallback when the GHL Calendar API is unreachable during slot fetching. */
export const FALLBACK_CALENDAR_UNAVAILABLE =
  "I'm having trouble checking availability right now. Can I get back to you in a few minutes?";

/** Fallback when the GHL Appointment API fails during booking creation. */
export const FALLBACK_APPOINTMENT_FAILED =
  "I'm having a bit of trouble confirming your booking. Let me get a team member to finalise this for you.";

/**
 * UK postcode pattern — matches both spaced (CF10 1AA) and unspaced (CF101AA) variants.
 * Word boundaries prevent partial matches inside longer strings, so "CF10 1AAA" does NOT match.
 */
export const POSTCODE_REGEX = /\b[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}\b/i;

/** Keywords that indicate a lead wants to book an appointment. */
export const BOOKING_KEYWORDS = [
  "book",
  "appointment",
  "schedule",
  "sign me up",
  "yes please",
];

/** Default SMS message type used for ContactCreate events where no channel is known. */
export const DEFAULT_MESSAGE_TYPE = "SMS";

/** A single message entry used to build conversation history for AI prompts. */
export interface OrchestratorMessage {
  content: string;
  role: "user" | "assistant";
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
  | { intent: "PROVIDE_POSTCODE"; data: { postcode: string } }
  | { intent: "INVALID_POSTCODE_FORMAT" }
  | { intent: "WANT_TO_BOOK" }
  | { intent: "UNKNOWN" };
