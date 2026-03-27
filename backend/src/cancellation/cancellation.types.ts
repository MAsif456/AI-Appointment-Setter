/**
 * Type definitions for the cancellation module.
 * Keeps interfaces separate from business logic to respect single-responsibility.
 */

/** Result of evaluating a clinic's cancellation policy against an appointment. */
export interface PolicyResult {
  /** True if the appointment falls within the clinic's notice period. */
  withinNotice: boolean;
  /** Whether the clinic charges a cancellation fee. */
  feeEnabled: boolean;
  /** Human-readable fee description, e.g. "£50". */
  feeDescription?: string;
  /** Warning message to show the lead (template-rendered or default). */
  warningMessage?: string;
}

/** Result of executing a cancellation in GHL and updating local state. */
export interface CancellationResult {
  success: boolean;
  /** Lead-facing confirmation or error message. */
  message: string;
}
