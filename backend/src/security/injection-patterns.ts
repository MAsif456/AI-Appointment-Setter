// Ref: OWASP LLM Prompt Injection Prevention Cheat Sheet
// https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
// Patterns derived from documented attack vectors + real-world prompt injection examples

import { ThreatCategory } from './security.types';

export interface PatternRule {
  category: ThreatCategory;
  pattern: RegExp;
  weight: number;
  label: string;
}

// Instruction Override
// High weight: these are unambiguous injection phrases
const INSTRUCTION_OVERRIDE_RULES: PatternRule[] = [
  {
    category: 'instruction_override',
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier|preceding)\s+(instructions|prompts|rules|directions|guidelines)/i,
    weight: 0.5,
    label: 'ignore_previous_instructions',
  },
  {
    category: 'instruction_override',
    pattern: /disregard\s+(your|the|all|any)\s+(instructions|programming|rules|guidelines|directives)/i,
    weight: 0.5,
    label: 'disregard_instructions',
  },
  {
    category: 'instruction_override',
    pattern: /forget\s+(everything|all|what)\s+(you were|you've been|about your)/i,
    weight: 0.5,
    label: 'forget_instructions',
  },
  {
    category: 'instruction_override',
    pattern: /do\s+not\s+follow\s+(your|the|any)\s+(previous|original|initial)\s+(instructions|rules)/i,
    weight: 0.45,
    label: 'do_not_follow',
  },
  {
    category: 'instruction_override',
    pattern: /override\s+(your|the|all|system)\s+((system|original|initial)\s+)?(instructions|rules|programming|prompts)/i,
    weight: 0.5,
    label: 'override_instructions',
  },
  {
    category: 'instruction_override',
    pattern: /new\s+instructions?\s*:/i,
    weight: 0.35,
    label: 'new_instructions',
  },
  {
    category: 'instruction_override',
    pattern: /stop\s+being\s+(a\s+)?(receptionist|booking|assistant)/i,
    weight: 0.4,
    label: 'stop_being_role',
  },
];

// Role Manipulation
const ROLE_MANIPULATION_RULES: PatternRule[] = [
  {
    category: 'role_manipulation',
    pattern: /you\s+are\s+now\s+(a|an|my|the)\b/i,
    weight: 0.45,
    label: 'you_are_now',
  },
  {
    category: 'role_manipulation',
    pattern: /act\s+as\s+(if\s+you\s+are\s+|a\s+|an\s+)/i,
    weight: 0.4,
    label: 'act_as',
  },
  {
    category: 'role_manipulation',
    pattern: /pretend\s+(to\s+be|you'?re|that\s+you)/i,
    weight: 0.4,
    label: 'pretend_to_be',
  },
  {
    category: 'role_manipulation',
    pattern: /your\s+new\s+role\s+is/i,
    weight: 0.45,
    label: 'new_role',
  },
  {
    category: 'role_manipulation',
    pattern: /switch\s+to\s+\w+\s+mode/i,
    weight: 0.4,
    label: 'switch_mode',
  },
  {
    category: 'role_manipulation',
    pattern: /you'?re\s+(actually|really)\s+(a|an|not)/i,
    weight: 0.35,
    label: 'youre_actually',
  },
  {
    category: 'role_manipulation',
    pattern: /from\s+now\s+on\s+you\s+(are|will|should|must)/i,
    weight: 0.45,
    label: 'from_now_on',
  },
  {
    category: 'role_manipulation',
    pattern: /\bno\s+restrictions?\b.*\b(tell|show|help|assist)\b/i,
    weight: 0.4,
    label: 'no_restrictions',
  },
];

// System Prompt Extraction
const SYSTEM_PROMPT_EXTRACTION_RULES: PatternRule[] = [
  {
    category: 'system_prompt_extraction',
    pattern: /(tell|show|reveal|repeat|display|print|output)\s+(me\s+)?(the\s+|your\s+)?(system|original|initial|hidden|secret)\s+(prompt|instructions?|message|configuration|rules)/i,
    weight: 0.5,
    label: 'reveal_system_prompt',
  },
  {
    category: 'system_prompt_extraction',
    pattern: /what\s+(are|were)\s+your\s+(instructions|rules|system\s+prompt|guidelines|directives)/i,
    weight: 0.45,
    label: 'what_are_your_instructions',
  },
  {
    category: 'system_prompt_extraction',
    pattern: /(dump|leak|expose|extract)\s+(your|the)\s+(prompt|config|system|instructions)/i,
    weight: 0.5,
    label: 'dump_prompt',
  },
  {
    category: 'system_prompt_extraction',
    pattern: /repeat\s+(everything|all)\s+(above|before|from\s+the\s+start)/i,
    weight: 0.45,
    label: 'repeat_above',
  },
  {
    category: 'system_prompt_extraction',
    pattern: /copy\s+(and\s+paste|paste)\s+(your|the)\s+(system|initial|original)/i,
    weight: 0.5,
    label: 'copy_paste_system',
  },
];

// Delimiter / Boundary Breaking
// Ref: OWASP Cheat Sheet — attackers try to close XML/markdown boundaries
const DELIMITER_BREAKING_RULES: PatternRule[] = [
  {
    category: 'delimiter_breaking',
    pattern: /<\/?system>/i,
    weight: 0.5,
    label: 'system_tag',
  },
  {
    category: 'delimiter_breaking',
    pattern: /\[\/?(SYSTEM|INST)\]/i,
    weight: 0.45,
    label: 'bracket_system_tag',
  },
  {
    category: 'delimiter_breaking',
    pattern: /<<\/?SYS>>/i,
    weight: 0.45,
    label: 'llama_sys_tag',
  },
  {
    category: 'delimiter_breaking',
    pattern: /END_OF_(SYSTEM|INSTRUCTIONS?|PROMPT)/i,
    weight: 0.4,
    label: 'end_of_system',
  },
  {
    category: 'delimiter_breaking',
    pattern: /###\s*(system|instruction|prompt)/i,
    weight: 0.35,
    label: 'markdown_system_header',
  },
  {
    category: 'delimiter_breaking',
    pattern: /<\/user_message>/i,
    weight: 0.5,
    label: 'close_user_message_tag',
  },
];

export const DETECTION_RULES: PatternRule[] = [
  ...INSTRUCTION_OVERRIDE_RULES,
  ...ROLE_MANIPULATION_RULES,
  ...SYSTEM_PROMPT_EXTRACTION_RULES,
  ...DELIMITER_BREAKING_RULES,
];
