/**
 * Standalone handler functions for consent flow responses.
 *
 * Follows the same pattern as orchestrator.cancel-handlers.ts and
 * orchestrator.returning-patient-handlers.ts — pure functions that
 * receive dependencies as parameters, not coupled to NestJS DI.
 */
import { ConsentService } from './consent.service';
import {
  CONSENT_ACKNOWLEDGED_RESPONSE,
  CONSENT_DECLINED_RESPONSE,
} from '../gdpr.types';

export interface ConsentHandlerDeps {
  consentService: ConsentService;
  leadId: string;
  clinicId: string;
  conversationId?: string;
  channel: string;
}

/** Records granted consent and returns the acknowledgement message. */
export async function handleConsentGranted(
  deps: ConsentHandlerDeps,
): Promise<string> {
  await deps.consentService.recordConsent(
    deps.leadId,
    deps.clinicId,
    'granted',
    deps.channel,
    deps.conversationId,
  );
  return CONSENT_ACKNOWLEDGED_RESPONSE;
}

/** Records declined consent and returns the polite refusal message. */
export async function handleConsentDeclined(
  deps: ConsentHandlerDeps,
): Promise<string> {
  await deps.consentService.recordConsent(
    deps.leadId,
    deps.clinicId,
    'declined',
    deps.channel,
    deps.conversationId,
  );
  return CONSENT_DECLINED_RESPONSE;
}
