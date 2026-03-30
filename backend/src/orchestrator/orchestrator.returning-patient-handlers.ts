/**
 * Static response handlers for returning patient detail confirmation.
 *
 * Mirrors the pattern established in orchestrator.cancel-handlers.ts.
 * Both functions return fixed strings so no AI call is needed for these
 * common confirmation exchanges, keeping response time fast and predictable.
 */

/**
 * Returns a confirmation message when a returning patient says their
 * details are unchanged. The conversation will skip qualifying and move
 * directly to booking after this response is sent.
 *
 * @returns A short SMS-friendly acknowledgement (under 160 characters).
 */
export function handleDetailsUnchanged(): string {
  return "Great, I'll use your details on file. Let me check what's available for you.";
}

/**
 * Returns a prompt asking for an updated postcode when a returning patient
 * says their details have changed. The conversation will move to qualifying
 * after this response is sent.
 *
 * @returns A short SMS-friendly prompt (under 160 characters).
 */
export function handleDetailsChanged(): string {
  return "No problem, let's get your details updated. What's your current postcode?";
}
