/**
 * Shared types for the staff escalation notification feature.
 *
 * These shapes mirror the backend API contract defined in the plan
 * for this user story. Backend DTOs should match exactly — if they
 * drift, update this file rather than duplicating the types.
 */

// All possible reasons an escalation can be raised. Kept as a union
// rather than a broader string so that UI copy is exhaustive.
export type EscalationTrigger =
  | 'failed_understanding'
  | 'emergency'
  | 'abuse';

/** Payload delivered over the SSE stream and returned by REST endpoints. */
export interface EscalationNotification {
  id: string;
  conversationId: string;
  leadId: string;
  leadName: string;
  // May be empty when GHL has no phone on file — the UI then disables
  // the "Call ASAP" primary action and surfaces a fallback message.
  leadPhone: string;
  clinicId: string;
  clinicName: string;
  trigger: EscalationTrigger;
  reason: string;
  createdAt: string;
  // Per-user flag populated by the REST list endpoint so the bell
  // can hide items the current staff member already dismissed.
  acknowledgedByMe?: boolean;
  // Clinic-wide resolution timestamp — once set, the card drops off
  // every staff member's queue, not just the one who acknowledged.
  resolvedAt?: string | null;
}

/** Response from GET /notifications/stream-token. */
export interface StreamTokenResponse {
  token: string;
  expiresInSec: number;
}
