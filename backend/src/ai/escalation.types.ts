import { ConversationDocument } from "../database/schemas/conversation.schema";
import { LeadDocument } from "../database/schemas/lead.schema";
import { ClinicDocument } from "../database/schemas/clinic.schema";

/**
 * All possible triggers for a human-staff escalation.
 * Kept in sync with the frontend union in `types/escalation.ts`.
 */
export type EscalationTrigger =
  | "failed_understanding"
  | "emergency"
  | "abuse";

/**
 * Input contract for `EscalationService.escalate(ctx)`.
 *
 * Every escalation path (failed understanding, abuse hand-off,
 * emergency keyword) builds one of these and delegates to the
 * orchestrator, so the GHL tag + custom field + persistence +
 * notification bus steps all run exactly once per escalation.
 */
export interface EscalationContext {
  conversation: ConversationDocument;
  lead: LeadDocument;
  clinic: ClinicDocument;
  trigger: EscalationTrigger;
  reason: string;
  /** Optional pre-built patient message (used by emergency path). */
  patientMessage?: string;
}

/** Shape returned by the orchestrator to the caller. */
export interface EscalationResultV2 {
  aiMessage: string;
  escalationReason: string;
  notificationId: string | null;
}
