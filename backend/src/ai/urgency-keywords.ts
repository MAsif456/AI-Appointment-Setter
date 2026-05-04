/**
 * Keyword dictionaries and MTS-inspired contextual pair definitions
 * for Layer 1 urgency classification.
 *
 * Emergency / urgent / routine keywords are weighted and matched
 * case-insensitively against the lead's message text.
 *
 * Contextual pairs adapt the Manchester Triage System's concept of
 * general and specific discriminators: a trigger word acts as a
 * "general discriminator", while adjacent escalator/de-escalator
 * words act as "specific discriminators" that refine the classification.
 */

import { UrgencyLevel } from "./urgency-detector.types";

export interface WeightedKeyword {
  phrase: string;
  weight: number;
  level: UrgencyLevel;
}

/**
 * MTS-inspired contextual pair.
 * When the trigger word is found, adjacent words (within CONTEXT_WINDOW)
 * are scanned for escalators or de-escalators.
 */
export interface ContextualPair {
  trigger: string;
  escalators: { words: string[]; level: UrgencyLevel };
  deEscalators: { words: string[]; level: UrgencyLevel };
  baseLevel: UrgencyLevel;
}

/** How many words either side of the trigger to scan for context. */
export const CONTEXT_WINDOW = 6;

// Note: apostrophes are stripped at scan time, so "can't" matches "cant"
export const EMERGENCY_KEYWORDS: WeightedKeyword[] = [
  "chest pain",
  "chest hurts",
  "chest is hurting",
  "chest tightness",
  "can't move",
  "can't breathe",
  "can't breath",
  "cannot breathe",
  "cannot breath",
  "can't walk",
  "can't feel my",
  "not breathing",
  "stopped breathing",
  "broken bone",
  "fracture",
  "dislocated",
  "heart attack",
  "stroke",
  "seizure",
  "fit",
  "unconscious",
  "passed out",
  "blacked out",
  "fainted",
  "collapsed",
  "severe bleeding",
  "heavy bleeding",
  "won't stop bleeding",
  "allergic reaction",
  "anaphylaxis",
  "choking",
  "999",
  "ambulance",
  "a&e",
  "emergency",
  "breathing difficulty",
  "difficulty breathing",
  "struggling to breathe",
  "struggling to breath",
  "hard to breathe",
  "hard to breath",
  "head injury",
  "lost consciousness",
  "paralysed",
  "paralyzed",
  "can't see",
  "lost vision",
  "gone blind",
  "overdose",
  "overdosed",
].map((phrase) => ({ phrase, weight: 1.0, level: "emergency" as const }));

export const URGENT_KEYWORDS: WeightedKeyword[] = [
  // Weight 0.85 — strong urgency signals
  ...[
    "asap",
    "as soon as possible",
    "urgently",
    "extreme pain",
    "immediately",
    "right away",
    "straight away",
  ].map((phrase) => ({ phrase, weight: 0.85, level: "urgent" as const })),

  // Weight 0.8 — clear urgency
  ...[
    "urgent",
    "same day",
    "can't wait",
    "severe pain",
    "earliest available",
    "first available",
    "need to be seen",
    "soon as you can",
    "so much pain",
    "a lot of pain",
    "agony",
    "in agony",
  ].map((phrase) => ({ phrase, weight: 0.8, level: "urgent" as const })),

  // Weight 0.75 — moderate urgency
  ...[
    "really painful",
    "very painful",
    "getting worse",
    "much worse",
    "keeps getting worse",
    "constant pain",
    "barely walk",
    "barely move",
    "can barely",
    "throbbing",
    "shooting pain",
    "desperate",
  ].map((phrase) => ({ phrase, weight: 0.75, level: "urgent" as const })),

  // Weight 0.7 — mild urgency signals
  ...["acute", "today", "swollen", "need help"].map((phrase) => ({
    phrase,
    weight: 0.7,
    level: "urgent" as const,
  })),
];

export const ROUTINE_KEYWORDS: WeightedKeyword[] = [
  // Weight 0.2
  ...[
    "next week",
    "flexible",
    "follow-up",
    "follow up",
    "not urgent",
    "at your convenience",
    "when convenient",
  ].map((phrase) => ({ phrase, weight: 0.2, level: "routine" as const })),

  // Weight 0.15
  ...[
    "no rush",
    "whenever",
    "any time",
    "when you have",
    "some point",
    "not in a rush",
    "take your time",
    "sometime soon",
  ].map((phrase) => ({ phrase, weight: 0.15, level: "routine" as const })),

  // Weight 0.1
  ...[
    "routine",
    "check-up",
    "check up",
    "general",
    "regular",
    "just wondering",
    "maintenance",
    "preventative",
    "prevention",
  ].map((phrase) => ({ phrase, weight: 0.1, level: "routine" as const })),
];

/** All flat keywords combined for a single-pass scan. */
export const ALL_KEYWORDS: WeightedKeyword[] = [
  ...EMERGENCY_KEYWORDS,
  ...URGENT_KEYWORDS,
  ...ROUTINE_KEYWORDS,
];

export const CONTEXTUAL_PAIRS: ContextualPair[] = [
  {
    trigger: "broke",
    escalators: {
      words: [
        "leg",
        "arm",
        "bone",
        "wrist",
        "ankle",
        "back",
        "neck",
        "hip",
        "rib",
        "foot",
        "hand",
        "jaw",
        "nose",
      ],
      level: "emergency",
    },
    deEscalators: {
      words: ["nail", "phone", "appointment", "glasses"],
      level: "routine",
    },
    baseLevel: "urgent",
  },
  {
    trigger: "broken",
    escalators: {
      words: [
        "leg",
        "arm",
        "bone",
        "wrist",
        "ankle",
        "back",
        "neck",
        "hip",
        "rib",
        "foot",
        "hand",
        "jaw",
        "nose",
      ],
      level: "emergency",
    },
    deEscalators: {
      words: ["nail", "phone", "appointment", "glasses"],
      level: "routine",
    },
    baseLevel: "urgent",
  },
  {
    trigger: "pain",
    escalators: {
      words: [
        "severe",
        "worst",
        "unbearable",
        "excruciating",
        "sudden",
        "sharp",
        "stabbing",
        "extreme",
        "intense",
      ],
      level: "urgent",
    },
    deEscalators: {
      words: ["mild", "slight", "little", "occasional", "minor", "dull"],
      level: "routine",
    },
    baseLevel: "routine",
  },
  {
    trigger: "hurt",
    escalators: {
      words: ["chest", "head", "heart", "skull"],
      level: "emergency",
    },
    deEscalators: {
      words: ["finger", "toe", "little", "slightly"],
      level: "routine",
    },
    baseLevel: "urgent",
  },
  {
    trigger: "swell",
    escalators: {
      words: ["throat", "face", "tongue", "lips", "mouth", "airway"],
      level: "emergency",
    },
    deEscalators: {
      words: ["knee", "ankle", "wrist", "finger", "toe"],
      level: "urgent",
    },
    baseLevel: "urgent",
  },
  {
    trigger: "numb",
    escalators: {
      words: ["arm", "leg", "face", "chest", "side", "left", "right"],
      level: "emergency",
    },
    deEscalators: { words: ["finger", "toe", "hand", "foot"], level: "urgent" },
    baseLevel: "urgent",
  },
];

/** Proportion of uppercase letters that suggests distress. */
export const CAPS_RATIO_THRESHOLD = 0.6;
/** Count of '!' characters that suggests urgency. */
export const EXCLAMATION_THRESHOLD = 3;
/** Score boost applied when behavioural markers are detected. */
export const BEHAVIOURAL_BOOST = 0.15;
