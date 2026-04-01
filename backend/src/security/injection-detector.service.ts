import { Injectable } from '@nestjs/common';
import {
  DetectionResult,
  SecurityFlag,
  THREAT_THRESHOLDS,
} from './security.types';
import { DETECTION_RULES, PatternRule } from './injection-patterns';

// Ref: DEV.to — 3-Layer Detection (Pattern + Heuristic + LLM)
// https://dev.to/zeshama/how-to-detect-prompt-injection-attacks-in-your-ai-agent-3-layers-5-minutes-2emd
// We implement Layers 1 (pattern matching) and 2 (heuristic scoring).
// Layer 3 (LLM-based deep scan) omitted — would double Groq API costs per message,
// not justified for a narrow-scope booking chatbot.

@Injectable()
export class InjectionDetectorService {
  private readonly rules: PatternRule[] = DETECTION_RULES;

  /**
   * Detects potential security threats in a given message.
   *
   * The detection process consists of two layers:
   * 1. Pattern matching (~0.1ms): checks the message against a set of predefined patterns.
   * 2. Heuristic scoring (~0.1ms): detects encoding/obfuscation attempts.
   *
   * The threat score is calculated as the sum of weights of all detected patterns and obfuscation attempts.
   * If the threat score is >= THREAT_THRESHOLDS.BLOCK, the message is blocked.
   * If the threat score is >= THREAT_THRESHOLDS.SANITISE, the message is sanitized.
   * Otherwise, the message is passed through.
   *
   * @param message The message to detect potential security threats in.
   * @returns An object containing the threat score, detected flags, and the recommended action.
   */
  detect(message: string): DetectionResult {
    const flags: SecurityFlag[] = [];
    let score = 0;

    // Layer 1: Pattern matching (~0.1ms)
    for (const rule of this.rules) {
      if (rule.pattern.test(message)) {
        flags.push({
          category: rule.category,
          pattern: rule.label,
          weight: rule.weight,
        });
        score += rule.weight;
      }
    }

    // Layer 2: Heuristic scoring — encoding/obfuscation detection
    const obfuscationFlags = this.detectObfuscation(message);
    for (const flag of obfuscationFlags) {
      flags.push(flag);
      score += flag.weight;
    }

    // Cap at 1.0
    score = Math.min(score, 1.0);

    let action: DetectionResult['action'] = 'pass';
    if (score >= THREAT_THRESHOLDS.BLOCK) {
      action = 'block';
    } else if (score >= THREAT_THRESHOLDS.SANITISE) {
      action = 'sanitise';
    }

    return { threatScore: score, flags, action };
  }

  // Ref: PromptGuard (Nature, 2025) — heuristic feature engineering catches
  // obfuscated attacks that regex patterns miss (homoglyphs, Base64, leetspeak)
  private detectObfuscation(message: string): SecurityFlag[] {
    const flags: SecurityFlag[] = [];

    // Excessive non-ASCII characters (potential homoglyph attack)
    // Normal medical text rarely has >10% non-ASCII; homoglyph attacks substitute
    // many Latin characters with visually similar Unicode glyphs
    const nonAsciiCount = (message.match(/[^\x00-\xFF]/g) || []).length;
    const nonAsciiRatio = message.length > 0 ? nonAsciiCount / message.length : 0;
    if (nonAsciiRatio > 0.3 && message.length > 10) {
      flags.push({
        category: 'encoding_obfuscation',
        pattern: 'excessive_unicode',
        weight: 0.25,
      });
    }

    // Base64-like patterns (long alphanumeric+/= strings)
    // Legitimate messages don't contain 40+ char Base64 sequences.
    // Require character diversity (at least 4 distinct chars) to avoid false
    // positives on repeated single characters (e.g., 'aaa...').
    const base64Match = message.match(/[A-Za-z0-9+/=]{40,}/);
    if (base64Match && new Set(base64Match[0]).size >= 4) {
      flags.push({
        category: 'encoding_obfuscation',
        pattern: 'base64_payload',
        weight: 0.3,
      });
    }

    // Leetspeak density — checks if the message contains injection keywords
    // written in leetspeak (e.g., "1gn0r3 pr3v10us 1nstruct10ns")
    const normalised = message
      .replace(/1/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e')
      .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
    if (normalised !== message) {
      for (const rule of this.rules) {
        if (rule.pattern.test(normalised) && !rule.pattern.test(message)) {
          flags.push({
            category: 'encoding_obfuscation',
            pattern: `leetspeak_${rule.label}`,
            weight: rule.weight * 0.8,
          });
          break;
        }
      }
    }

    return flags;
  }
}
