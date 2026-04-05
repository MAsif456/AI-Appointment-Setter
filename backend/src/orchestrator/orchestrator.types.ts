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

/** Keywords that indicate a lead wants to cancel their appointment. */
export const CANCEL_KEYWORDS = [
  'cancel', "can't come", "can't make it", "won't be able",
  'cancel my booking', 'cancel my appointment', 'cancel the appointment',
  'need to cancel', 'want to cancel', 'like to cancel',
  "can't attend", "unable to attend", "unable to make it",
  'withdraw', 'call it off', 'drop my appointment',
  "won't make it", "won't be coming", "not going to make it",
  "can no longer make", "no longer need",
];

/** Keywords that confirm a pending action (cancellation confirmation). */
export const CONFIRM_KEYWORDS = [
  'yes', 'correct', 'confirm', 'go ahead', 'please cancel', 'yeah', 'yep', 'sure',
  'ok', 'okay', 'that is correct', "that's correct", 'absolutely', 'definitely',
  'proceed', 'do it', 'yes please', 'yea', 'aye',
];

/** Keywords that decline a pending cancellation. */
export const DECLINE_CANCEL_KEYWORDS = [
  'no', 'never mind', 'keep it', "don't cancel", 'keep my appointment',
  'changed my mind', 'forget it', 'leave it', 'no thanks', 'nah',
  "i'll keep it", "i'll still come", "actually no", 'on second thought',
];

/** Keywords indicating a returning patient confirms their details are unchanged. */
export const DETAILS_UNCHANGED_KEYWORDS = [
  'yes', 'same', 'nothing changed', "hasn't changed", 'all the same',
  'still the same', 'no changes', 'correct', "that's right", 'all correct',
  'yep', 'yeah', 'yea', 'right', 'aye', 'ok', 'okay',
];

/** Keywords indicating a returning patient says their details have changed. */
export const DETAILS_CHANGED_KEYWORDS = [
  'moved', 'new address', 'different postcode', 'changed', 'new number',
  'different number', 'updated', 'no longer', 'different details', 'different area',
  'no', 'nope', 'not the same', 'they have changed', 'details have changed',
];

/**
 * Checks whether a message matches any of the given keywords with context-aware precision.
 *
 * - Single-word keywords: only match when the full trimmed message IS that word exactly.
 *   This prevents "yes I have back pain" triggering DETAILS_UNCHANGED via the 'yes' keyword.
 * - Multi-word phrases (keywords containing a space): use substring matching (includes),
 *   since partial phrase matches are intentional (e.g. "nothing changed" inside a sentence).
 *
 * @param lower - The already-lowercased, trimmed message.
 * @param keywords - The keyword list to test against.
 */
export function matchesKeywords(lower: string, keywords: string[]): boolean {
  return keywords.some((kw) =>
    kw.includes(' ') ? lower.includes(kw) : lower === kw,
  );
}

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
  /** MongoDB ObjectId of the conversation document (as hex string). */
  conversationId?: string;
  patientInfo: {
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    issue?: string;
    validatedPostcode?: string;
  };
  /** True when a PatientHistory record was matched at conversation start. */
  isReturningPatient?: boolean;
  channel?: string;
}

/** Static response returned when a message looks like a postcode but is not a valid UK format. */
export const INVALID_POSTCODE_RESPONSE =
  "That doesn't look like a UK postcode. Could you double-check and send it again?";

/** Discriminated union of all possible detected intents. */
export type IntentResult =
  | { intent: "PROVIDE_POSTCODE"; data: { postcode: string } }
  | { intent: "INVALID_POSTCODE_FORMAT" }
  | { intent: "WANT_TO_BOOK" }
  | { intent: "CANCEL" }
  | { intent: "CONFIRM_CANCEL" }
  | { intent: "DECLINE_CANCEL" }
  | { intent: "DETAILS_UNCHANGED" }
  | { intent: "DETAILS_CHANGED" }
  | { intent: "UNKNOWN" };
