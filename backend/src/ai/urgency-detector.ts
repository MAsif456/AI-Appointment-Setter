/**
 * Layer 1 urgency classifier: a pure-function module that scans text
 * using weighted keyword dictionaries, MTS-inspired contextual pairs,
 * and behavioural linguistic markers.
 *
 * Follows the same pure-function pattern as slot-selector.ts.
 */

import {
  UrgencyLevel,
  UrgencyAssessment,
  UrgencySignal,
  URGENCY_RANK,
} from "./urgency-detector.types";
import {
  ALL_KEYWORDS,
  CONTEXTUAL_PAIRS,
  CONTEXT_WINDOW,
  CAPS_RATIO_THRESHOLD,
  EXCLAMATION_THRESHOLD,
  BEHAVIOURAL_BOOST,
} from "./urgency-keywords";

const EMERGENCY_THRESHOLD = 0.9;
const URGENT_THRESHOLD = 0.6;
const ROUTINE_CEILING = 0.3;

/**
 * Returns an empty UrgencyAssessment object with default values.
 * @returns {UrgencyAssessment} - An empty UrgencyAssessment object.
 */

function buildEmptyAssessment(): UrgencyAssessment {
  return {
    level: "routine",
    score: 0,
    signals: [],
    isAmbiguous: false,
    requiresEscalation: false,
    emergencyKeywordsMatched: [],
  };
}

/** Tokenise text into lowercase words for contextual-pair scanning. */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Scans the input text for occurrences of weighted keywords and returns an array
 * of UrgencySignal objects. Each signal represents a detected keyword and its
 * associated score and classification.
 * @param {string} text - The input text to scan for keywords.
 * @returns {UrgencySignal[]} - An array of UrgencySignal objects.
 */
function scanKeywords(text: string): UrgencySignal[] {
  // Strip apostrophes so "cant move" matches "can't move"
  const lower = text.toLowerCase().replace(/['']/g, "");
  const signals: UrgencySignal[] = [];

  for (const kw of ALL_KEYWORDS) {
    if (lower.includes(kw.phrase.replace(/['']/g, ""))) {
      signals.push({
        source: "keyword",
        text: kw.phrase,
        score: kw.weight,
        classification: kw.level,
      });
    }
  }
  return signals;
}

/**
 * Scans the input text for contextual pairs, using the MTS-inspired
 * discriminator logic. This function takes the input text and tokenises it
 * into individual words. It then iterates over the CONTEXTUAL_PAIRS
 * array, finding all indices of the trigger word in the tokenised
 * array. For each trigger index, it creates a window of words
 * around the trigger index, and checks if any of the words in the
 * window match the escalator or de-escalator words for the current
 * contextual pair. If a match is found, it adds a signal to the
 * output array with the associated score and classification.
 *
 * @returns {UrgencySignal[]} - An array of UrgencySignal objects
 * representing the detected contextual pairs and their associated scores
 * and classifications.
 */
function scanContextualPairs(text: string): UrgencySignal[] {
  const words = tokenise(text);
  const signals: UrgencySignal[] = [];

  for (const pair of CONTEXTUAL_PAIRS) {
    const triggerIndices = words.reduce<number[]>((acc, w, i) => {
      if (w.includes(pair.trigger)) acc.push(i);
      return acc;
    }, []);

    for (const idx of triggerIndices) {
      const windowStart = Math.max(0, idx - CONTEXT_WINDOW);
      const windowEnd = Math.min(words.length, idx + CONTEXT_WINDOW + 1);
      const window = words.slice(windowStart, windowEnd);

      const escalatorHit = pair.escalators.words.find((e) =>
        window.some((w) => w.includes(e)),
      );
      const deEscalatorHit = pair.deEscalators.words.find((d) =>
        window.some((w) => w.includes(d)),
      );

      if (escalatorHit) {
        signals.push({
          source: "keyword",
          text: `${pair.trigger} + ${escalatorHit}`,
          score: pair.escalators.level === "emergency" ? 1.0 : 0.8,
          classification: pair.escalators.level,
        });
      } else if (deEscalatorHit) {
        signals.push({
          source: "keyword",
          text: `${pair.trigger} + ${deEscalatorHit}`,
          score: pair.deEscalators.level === "routine" ? 0.15 : 0.5,
          classification: pair.deEscalators.level,
        });
      }
    }
  }
  return signals;
}

/**
 * Detects behavioral markers in the input text, such as excessive
 * capitalization or exclamation marks. Returns a score boost
 * representing the detected markers.
 *
 * @param {string} text - The input text to scan for behavioral
 * markers.
 * @returns {number} - A score boost representing the detected
 * behavioral markers.
 */
function detectBehaviouralMarkers(text: string): number {
  let boost = 0;
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 3) {
    const upper = letters.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length >= CAPS_RATIO_THRESHOLD)
      boost += BEHAVIOURAL_BOOST;
  }
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations >= EXCLAMATION_THRESHOLD) boost += BEHAVIOURAL_BOOST;
  return boost;
}

/**
 * Maps a score to an UrgencyLevel and ambiguity flag.
 * @param {number} score - The input score to map to an UrgencyLevel.
 * @returns {Object} - An object with 'level' and 'isAmbiguous' properties.
 * @property {UrgencyLevel} level - The mapped UrgencyLevel.
 * @property {boolean} isAmbiguous - Whether the score falls within an ambiguous range.
 * @note The mapping is as follows: score >= EMERGENCY_THRESHOLD -> 'emergency', score >= URGENT_THRESHOLD -> 'urgent', score <= ROUTINE_CEILING -> 'routine', otherwise -> 'urgent' with isAmbiguous set to true.
 */
function scoreToLevel(score: number): {
  level: UrgencyLevel;
  isAmbiguous: boolean;
} {
  if (score >= EMERGENCY_THRESHOLD)
    return { level: "emergency", isAmbiguous: false };
  if (score >= URGENT_THRESHOLD) return { level: "urgent", isAmbiguous: false };
  if (score <= ROUTINE_CEILING) return { level: "routine", isAmbiguous: false };
  return { level: "urgent", isAmbiguous: true }; // ambiguous band
}

/**
 * Layer 1 classifier. Scans text for keyword matches, contextual pairs,
 * and behavioural markers. Returns an UrgencyAssessment.
 */
export function classifyUrgencyFromText(text: string): UrgencyAssessment {
  if (!text || !text.trim()) return buildEmptyAssessment();

  const keywordSignals = scanKeywords(text);
  const contextSignals = scanContextualPairs(text);
  const allSignals = [...keywordSignals, ...contextSignals];

  if (allSignals.length === 0) {
    const boost = detectBehaviouralMarkers(text);
    if (boost > 0) {
      const { level, isAmbiguous } = scoreToLevel(boost);
      return {
        level,
        score: boost,
        isAmbiguous,
        signals: [
          {
            source: "message",
            text: "(behavioural markers)",
            score: boost,
            classification: level,
          },
        ],
        requiresEscalation: level === "emergency",
        emergencyKeywordsMatched: [],
      };
    }
    return buildEmptyAssessment();
  }

  // Use the highest signal score as the primary score, boosted by behavioural markers.
  const maxSignalScore = Math.max(...allSignals.map((s) => s.score));
  const behaviouralBoost = detectBehaviouralMarkers(text);
  const finalScore = Math.min(1.0, maxSignalScore + behaviouralBoost);

  // If any signal is emergency-level, the overall level is emergency.
  const hasEmergency = allSignals.some((s) => s.classification === "emergency");
  const emergencyMatches = allSignals
    .filter((s) => s.classification === "emergency")
    .map((s) => s.text);

  if (hasEmergency) {
    return {
      level: "emergency",
      score: Math.max(finalScore, EMERGENCY_THRESHOLD),
      signals: allSignals,
      isAmbiguous: false,
      requiresEscalation: true,
      emergencyKeywordsMatched: emergencyMatches,
    };
  }

  const { level, isAmbiguous } = scoreToLevel(finalScore);
  return {
    level,
    score: finalScore,
    signals: allSignals,
    isAmbiguous,
    requiresEscalation: false,
    emergencyKeywordsMatched: [],
  };
}

/**
 * Classifies the lead's initial form-submission issue field.
 * Uses the same keyword engine as classifyUrgencyFromText.
 */
export function classifyFormData(issue: string | undefined): UrgencyAssessment {
  if (!issue || !issue.trim()) return buildEmptyAssessment();
  const assessment = classifyUrgencyFromText(issue);
  // Re-tag signals as form_data source
  assessment.signals = assessment.signals.map((s) => ({
    ...s,
    source: "form_data" as const,
  }));
  return assessment;
}

/**
 * Merges previous urgency with a new assessment.
 * Urgency can only escalate, never de-escalate (clinical safety principle
 * inspired by DCB0129 — once a risk is identified it stays identified).
 */
export function mergeAssessments(
  previous: UrgencyLevel | "unknown",
  current: UrgencyAssessment,
): UrgencyLevel {
  const prevRank = URGENCY_RANK[previous] ?? 0;
  const currRank = URGENCY_RANK[current.level] ?? 0;
  if (currRank >= prevRank) return current.level;
  return previous === "unknown" ? current.level : previous;
}

/**
 * Returns true when the assessment falls in the ambiguous band
 * and no emergency keywords were matched — meaning Layer 2 (LLM)
 * should be consulted for a more nuanced classification.
 */
export function needsLlmClassification(assessment: UrgencyAssessment): boolean {
  return (
    assessment.isAmbiguous && assessment.emergencyKeywordsMatched.length === 0
  );
}
