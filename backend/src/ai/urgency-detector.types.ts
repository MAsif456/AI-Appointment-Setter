/**
 * Shared types for the urgency detection system.
 *
 * Urgency levels are inspired by the Manchester Triage System (MTS)
 * and NHS 111 Pathways disposition categories:
 *   emergency > MTS Red/Orange (immediate/very urgent), NHS 111 "999 dispatch"
 *   urgent    > MTS Yellow (urgent), NHS 111 "same-day GP"
 *   routine   > MTS Green/Blue (standard/non-urgent), NHS 111 "routine GP"
 */

export type UrgencyLevel = 'routine' | 'urgent' | 'emergency';

/** Ordering used by mergeAssessments — urgency can only escalate. */
export const URGENCY_RANK: Record<UrgencyLevel | 'unknown', number> = {
  unknown: 0,
  routine: 1,
  urgent: 2,
  emergency: 3,
};

export interface UrgencySignal {
  /** Where the signal originated */
  source: 'form_data' | 'message' | 'keyword' | 'llm';
  /** The text fragment that triggered the signal */
  text: string;
  score: number;
  classification: UrgencyLevel;
}

export interface UrgencyAssessment {
  level: UrgencyLevel;
  /** Aggregate score 0.0–1.0 */
  score: number;
  signals: UrgencySignal[];
  /** True when score falls in the ambiguous band (needs Layer 2 LLM) */
  isAmbiguous: boolean;
  /** True when level is 'emergency' */
  requiresEscalation: boolean;
  emergencyKeywordsMatched: string[];
}

export interface UrgencyContext {
  level: UrgencyLevel | 'unknown';
  isEmergency: boolean;
  emergencyMessage?: string;
}

export interface EscalationResult {
  aiMessage: string;
  escalationReason: string;
}
