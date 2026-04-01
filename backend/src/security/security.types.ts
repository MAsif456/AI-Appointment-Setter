// Ref: OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection
// https://genai.owasp.org/llmrisk/llm01-prompt-injection/
// Defense-in-depth: input validation + output filtering + structured logging

export type SecurityAction = 'pass' | 'sanitise' | 'block';

export type SecurityEventType =
  | 'injection_detected'
  | 'injection_blocked'
  | 'output_blocked'
  | 'message_sanitised'
  | 'rate_limited';

export type ThreatCategory =
  | 'instruction_override'
  | 'role_manipulation'
  | 'system_prompt_extraction'
  | 'delimiter_breaking'
  | 'encoding_obfuscation';

export type OutputThreatCategory =
  | 'system_prompt_leakage'
  | 'internal_config_exposure'
  | 'off_topic_content'
  | 'excessive_length'
  | 'role_confusion';

export interface SecurityFlag {
  category: ThreatCategory;
  pattern: string;
  weight: number;
}

export interface DetectionResult {
  threatScore: number;
  flags: SecurityFlag[];
  action: SecurityAction;
}

// Ref: PromptGuard (Nature, 2025) — graduated scoring outperforms binary detection
// https://www.nature.com/articles/s41598-025-31086-y
// Thresholds tunable without rewriting detection logic
export const THREAT_THRESHOLDS = {
  SANITISE: 0.3,
  BLOCK: 0.6,
} as const;

export const MAX_INJECTION_ATTEMPTS = 3;

export interface SecurityResult {
  allowed: boolean;
  sanitisedMessage: string;
  threatScore: number;
  flags: SecurityFlag[];
  fallbackResponse?: string;
}

export interface OutputValidationResult {
  safe: boolean;
  flags: OutputThreatCategory[];
  fallbackResponse?: string;
}

export interface SecurityLogEntry {
  eventType: SecurityEventType;
  threatScore: number;
  flags: string[];
  originalMessage: string;
  sanitisedMessage?: string;
  conversationId: string;
  clinicId: string;
  timestamp: Date;
  action: SecurityAction;
}

// Phase-aware fallback responses — patient never notices security intervened
// Serves stakeholder value: booking flow continues uninterrupted
export const PHASE_FALLBACKS: Record<string, string> = {
  greeting: "Hello! I'm the clinic receptionist. Could you share your postcode so I can check we cover your area?",
  qualifying: 'Could you please share your postcode so I can check if we cover your area?',
  qualified: 'Would you like to go ahead and book an appointment?',
  booking: 'Let me check our available times for you.',
  default: "I'm here to help you book an appointment. How can I assist?",
};

export const INPUT_LIMITS = {
  MAX_LENGTH: 5000,
  EMPTY_RESPONSE: 'Sorry, I didn\'t catch that. Could you please repeat your message?',
} as const;
