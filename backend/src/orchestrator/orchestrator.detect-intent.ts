/**
 * Standalone intent detection function extracted from OrchestratorService
 * to keep orchestrator.service.ts under the 200-line limit.
 */
import {
  POSTCODE_REGEX,
  BOOKING_KEYWORDS,
  RESCHEDULE_KEYWORDS,
  CANCEL_RESCHEDULE_KEYWORDS,
  CANCEL_KEYWORDS,
  CONFIRM_KEYWORDS,
  DECLINE_CANCEL_KEYWORDS,
  DETAILS_UNCHANGED_KEYWORDS,
  DETAILS_CHANGED_KEYWORDS,
  matchesKeywords,
  OrchestratorContext,
  IntentResult,
} from './orchestrator.types';
import { normalisePostcode } from './orchestrator.prompts';

/**
 * Detects the intent of an inbound message based on its content and the current phase.
 *
 * Phase-gating rules:
 *   - DETAILS_UNCHANGED / DETAILS_CHANGED: only in 'greeting' phase for returning patients.
 *   - PROVIDE_POSTCODE / INVALID_POSTCODE_FORMAT: only in 'qualifying' phase.
 *   - WANT_TO_BOOK: only in 'qualified' phase.
 *   - RESCHEDULE: only in 'booked' phase.
 *   - CANCEL_RESCHEDULE: only in 'rescheduling' phase.
 *   - Cancellation intents: only in 'booked', 'cancelling', 'cancelling_warned' phases.
 */
export function detectOrchestratorIntent(
  messageContent: string,
  currentPhase: string,
  context?: Pick<OrchestratorContext, 'isReturningPatient'>,
): IntentResult {
  const lower = messageContent.toLowerCase();

  if (currentPhase === 'greeting' && context?.isReturningPatient) {
    if (matchesKeywords(lower, DETAILS_UNCHANGED_KEYWORDS)) return { intent: 'DETAILS_UNCHANGED' };
    if (matchesKeywords(lower, DETAILS_CHANGED_KEYWORDS)) return { intent: 'DETAILS_CHANGED' };
  }

  if (currentPhase === 'qualifying') {
    const postcodeMatch = messageContent.match(POSTCODE_REGEX);
    if (postcodeMatch) {
      return { intent: 'PROVIDE_POSTCODE', data: { postcode: normalisePostcode(postcodeMatch[0]) } };
    }
    if (looksLikePostcodeAttempt(messageContent)) return { intent: 'INVALID_POSTCODE_FORMAT' };
  }

  if (currentPhase === 'qualified') {
    if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) return { intent: 'WANT_TO_BOOK' };
  }

  if (currentPhase === 'booked') {
    if (RESCHEDULE_KEYWORDS.some((kw) => lower.includes(kw))) return { intent: 'RESCHEDULE' };
    if (CANCEL_KEYWORDS.some((kw) => lower.includes(kw))) return { intent: 'CANCEL' };
  }

  if (currentPhase === 'rescheduling') {
    if (CANCEL_RESCHEDULE_KEYWORDS.some((kw) => lower.includes(kw))) return { intent: 'CANCEL_RESCHEDULE' };
  }

  if (currentPhase === 'cancelling' || currentPhase === 'cancelling_warned') {
    if (CONFIRM_KEYWORDS.some((kw) => lower.includes(kw))) return { intent: 'CONFIRM_CANCEL' };
    if (DECLINE_CANCEL_KEYWORDS.some((kw) => lower.includes(kw))) return { intent: 'DECLINE_CANCEL' };
  }

  if (currentPhase === 'cancelled') {
    if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) return { intent: 'WANT_TO_BOOK' };
  }

  return { intent: 'UNKNOWN' };
}

function looksLikePostcodeAttempt(message: string): boolean {
  const stripped = message.replace(/\s+/g, '');
  return stripped.length >= 3 && stripped.length <= 9 && /^[A-Z0-9]+$/i.test(stripped);
}
