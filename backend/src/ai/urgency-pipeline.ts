import { Injectable, Logger } from "@nestjs/common";
import {
  classifyUrgencyFromText,
  classifyFormData,
  mergeAssessments,
  needsLlmClassification,
} from "./urgency-detector";
import { UrgencyLevel, UrgencyAssessment } from "./urgency-detector.types";
import { UrgencyLlmClassifier } from "./urgency-llm-classifier";

/** Return value of the full urgency detection pipeline. */
export interface UrgencyPipelineResult {
  resolved: UrgencyLevel;
  assessment: UrgencyAssessment;
}

/**
 * Orchestrates the two-layer urgency detection pipeline:
 *   Layer 1 — fast keyword + contextual-pair + behavioural-marker scan
 *   Layer 2 — conditional LLM micro-classification for ambiguous cases
 *
 * Single responsibility: determine the urgency level for a piece of text.
 * Does NOT persist anything or trigger side-effects.
 */
@Injectable()
export class UrgencyPipeline {
  private readonly logger = new Logger(UrgencyPipeline.name);

  constructor(private readonly llmClassifier: UrgencyLlmClassifier) {}

  /**
   * Runs both detection layers on a user message and returns the resolved urgency.
   * @param userMessage  The lead's latest chat message
   * @param currentUrgency  The lead's existing urgency (for monotonic merge)
   * @param leadIssue  Optional form-submission issue field (passed to Layer 2)
   */
  async assessMessage(
    userMessage: string,
    currentUrgency: UrgencyLevel | "unknown",
    leadIssue?: string,
  ): Promise<UrgencyPipelineResult> {
    // Layer 1: keyword + contextual pairs + behavioural markers
    const assessment = classifyUrgencyFromText(userMessage);
    let resolved = mergeAssessments(currentUrgency, assessment);

    // Layer 2: LLM micro-classification (only when Layer 1 is ambiguous)
    if (needsLlmClassification(assessment)) {
      try {
        const llmLevel = await this.llmClassifier.classify(
          userMessage,
          leadIssue,
        );
        resolved = mergeAssessments(resolved, {
          ...assessment,
          level: llmLevel,
        });
      } catch (err) {
        this.logger.warn(
          `Layer 2 urgency classification failed: ${err.message}`,
        );
      }
    }

    return { resolved, assessment };
  }

  /**
   * Pre-classifies urgency from the lead's form-submission issue field.
   * Used before the first greeting.
   */
  assessFormData(issue: string | undefined): UrgencyPipelineResult {
    const assessment = classifyFormData(issue);
    return { resolved: assessment.level, assessment };
  }
}
