import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from './groq.service';
import { UrgencyLevel } from './urgency-detector.types';

/** Timeout for the LLM micro-classification call (shorter than main 30s). */
const LLM_CLASSIFY_TIMEOUT_MS = 3_000;

/**
 * Layer 2 urgency classifier — uses the existing Groq/Llama service
 * for nuanced classification of ambiguous messages.
 *
 * Only invoked when Layer 1 (keyword-based) produces an ambiguous score.
 * Falls back to 'urgent' (safe middle ground) on any failure.
 */
@Injectable()
export class UrgencyLlmClassifier {
  private readonly logger = new Logger(UrgencyLlmClassifier.name);

  constructor(private readonly groqService: GroqService) {}

  /**
   * Classifies a lead's message using the LLM micro-classification service
   * as a fallback when the keyword-based classifier is ambiguous.
   *
   * @param text - the lead's message text
   * @param leadIssue - the lead's initial issue (optional)
   * @returns a promise resolving to the classification result as an UrgencyLevel
   * @throws if the LLM classification call times out
   */
  async classify(text: string, leadIssue?: string): Promise<UrgencyLevel> {
    const systemPrompt =
      'You are a medical triage classifier. Classify the following patient message ' +
      'as ROUTINE, URGENT, or EMERGENCY. Consider the medical context. ' +
      'Respond with ONLY one word: ROUTINE, URGENT, or EMERGENCY.';

    const userContent = leadIssue
      ? `Patient issue: ${leadIssue}\nMessage: ${text}`
      : text;

    try {
      const result = await Promise.race([
        this.groqService.generateChatResponse([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ]),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('LLM classification timeout')), LLM_CLASSIFY_TIMEOUT_MS),
        ),
      ]);

      return this.parseResponse(result);
    } catch (error) {
      this.logger.warn(`Layer 2 classification failed, defaulting to urgent: ${error.message}`);
      return 'urgent';
    }
  }

  /**
   * Maps the LLM micro-classification response to an UrgencyLevel,
   * falling back to 'urgent' if the response is null or unexpected.
   *
   * @param response - the LLM micro-classification response, or null on timeout
   * @returns an UrgencyLevel value
   */
  private parseResponse(response: string | null): UrgencyLevel {
    if (!response) return 'urgent';
    const cleaned = response.trim().toUpperCase();
    if (cleaned.includes('EMERGENCY')) return 'emergency';
    if (cleaned.includes('ROUTINE')) return 'routine';
    if (cleaned.includes('URGENT')) return 'urgent';
    return 'urgent'; // safe default for unexpected output
  }
}
