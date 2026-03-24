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

import { UrgencyLevel } from './urgency-detector.types';

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

export const EMERGENCY_KEYWORDS: WeightedKeyword[] = [
  'chest pain', "can't move", "can't breathe", "can't walk",
  'broken bone', 'fracture', 'heart attack', 'stroke',
  'unconscious', 'severe bleeding', 'allergic reaction',
  'anaphylaxis', 'seizure', '999', 'ambulance', 'a&e',
  'breathing difficulty', "difficulty breathing",
].map(phrase => ({ phrase, weight: 1.0, level: 'emergency' as const }));

export const URGENT_KEYWORDS: WeightedKeyword[] = [
  { phrase: 'asap', weight: 0.85, level: 'urgent' },
  { phrase: 'as soon as possible', weight: 0.85, level: 'urgent' },
  { phrase: 'urgently', weight: 0.85, level: 'urgent' },
  { phrase: 'urgent', weight: 0.8, level: 'urgent' },
  { phrase: 'same day', weight: 0.8, level: 'urgent' },
  { phrase: "can't wait", weight: 0.8, level: 'urgent' },
  { phrase: 'really painful', weight: 0.75, level: 'urgent' },
  { phrase: 'very painful', weight: 0.75, level: 'urgent' },
  { phrase: 'getting worse', weight: 0.75, level: 'urgent' },
  { phrase: 'severe pain', weight: 0.8, level: 'urgent' },
  { phrase: 'extreme pain', weight: 0.85, level: 'urgent' },
  { phrase: 'acute', weight: 0.7, level: 'urgent' },
  { phrase: 'today', weight: 0.7, level: 'urgent' },
];

export const ROUTINE_KEYWORDS: WeightedKeyword[] = [
  { phrase: 'no rush', weight: 0.15, level: 'routine' },
  { phrase: 'whenever', weight: 0.15, level: 'routine' },
  { phrase: 'next week', weight: 0.2, level: 'routine' },
  { phrase: 'any time', weight: 0.15, level: 'routine' },
  { phrase: 'flexible', weight: 0.2, level: 'routine' },
  { phrase: 'when you have', weight: 0.15, level: 'routine' },
  { phrase: 'routine', weight: 0.1, level: 'routine' },
  { phrase: 'check-up', weight: 0.1, level: 'routine' },
  { phrase: 'check up', weight: 0.1, level: 'routine' },
  { phrase: 'follow-up', weight: 0.15, level: 'routine' },
  { phrase: 'follow up', weight: 0.15, level: 'routine' },
  { phrase: 'some point', weight: 0.15, level: 'routine' },
];

/** All flat keywords combined for a single-pass scan. */
export const ALL_KEYWORDS: WeightedKeyword[] = [
  ...EMERGENCY_KEYWORDS,
  ...URGENT_KEYWORDS,
  ...ROUTINE_KEYWORDS,
];

export const CONTEXTUAL_PAIRS: ContextualPair[] = [
  {
    trigger: 'broke',
    escalators: {
      words: ['leg', 'arm', 'bone', 'wrist', 'ankle', 'back', 'neck', 'hip', 'rib', 'foot', 'hand', 'jaw', 'nose'],
      level: 'emergency',
    },
    deEscalators: {
      words: ['nail', 'phone', 'appointment', 'glasses'],
      level: 'routine',
    },
    baseLevel: 'urgent',
  },
  {
    trigger: 'broken',
    escalators: {
      words: ['leg', 'arm', 'bone', 'wrist', 'ankle', 'back', 'neck', 'hip', 'rib', 'foot', 'hand', 'jaw', 'nose'],
      level: 'emergency',
    },
    deEscalators: {
      words: ['nail', 'phone', 'appointment', 'glasses'],
      level: 'routine',
    },
    baseLevel: 'urgent',
  },
  {
    trigger: 'pain',
    escalators: {
      words: ['severe', 'worst', 'unbearable', 'excruciating', 'sudden', 'sharp', 'stabbing', 'extreme', 'intense'],
      level: 'urgent',
    },
    deEscalators: {
      words: ['mild', 'slight', 'little', 'occasional', 'minor', 'dull'],
      level: 'routine',
    },
    baseLevel: 'routine',
  },
  {
    trigger: 'swell',
    escalators: {
      words: ['throat', 'face', 'tongue', 'lips', 'mouth', 'airway'],
      level: 'emergency',
    },
    deEscalators: {
      words: ['knee', 'ankle', 'wrist', 'finger', 'toe'],
      level: 'urgent',
    },
    baseLevel: 'urgent',
  },
];

/** Proportion of uppercase letters that suggests distress. */
export const CAPS_RATIO_THRESHOLD = 0.6;
/** Count of '!' characters that suggests urgency. */
export const EXCLAMATION_THRESHOLD = 3;
/** Score boost applied when behavioural markers are detected. */
export const BEHAVIOURAL_BOOST = 0.15;
