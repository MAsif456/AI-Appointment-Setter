import { Injectable, Logger } from "@nestjs/common";
import { GroqService } from "./groq.service";

/** Timeout for the LLM classification call — shorter than main chat. */
const CLASSIFY_TIMEOUT_MS = 3_000;

/** Output of the classifier. `unclear` is the only trigger that counts. */
export type ComprehensionResult = "understood" | "unclear";

/**
 * Obvious "I don't understand" phrases that let us skip a Groq call
 * entirely. Kept short on purpose — false positives here block the
 * lead unnecessarily, so only the clearest giveaways are listed.
 */
const UNCLEAR_PHRASES: readonly string[] = [
  "i'm not sure",
  "i am not sure",
  "could you rephrase",
  "could you clarify",
  "i don't understand",
  "i do not understand",
  "not sure what you mean",
  "can you explain",
];

/**
 * Lightweight classifier that decides whether the draft AI reply
 * indicates the bot understood the user or is bailing out.
 *
 * Pattern mirrors `urgency-llm-classifier.ts`: heuristic first,
 * Groq call as a fallback, fail-open on any infra issue — we would
 * rather miss a real comprehension failure than escalate every time
 * Groq hiccups.
 */
@Injectable()
export class ComprehensionClassifier {
  private readonly logger = new Logger(ComprehensionClassifier.name);

  constructor(private readonly groqService: GroqService) {}

  /**
   * Classifies a single AI turn.
   *
   * @param userMessage - the inbound lead message that produced the reply
   * @param aiDraftReply - the AI-generated reply about to be sent back
   * @returns `unclear` when the classifier is confident the AI did not
   *          understand the lead; otherwise `understood`
   */
  async classify(
    userMessage: string,
    aiDraftReply: string,
  ): Promise<ComprehensionResult> {
    // Heuristic pre-filter — cheap, deterministic, no network.
    const lowered = aiDraftReply.toLowerCase();
    if (UNCLEAR_PHRASES.some((p) => lowered.includes(p))) {
      return "unclear";
    }

    const systemPrompt =
      "You are a classifier for a dental clinic chatbot. Decide whether " +
      "the AI's draft reply shows it understood the patient's message. " +
      "Respond with ONLY one word: UNDERSTOOD or UNCLEAR.";
    const userContent =
      `Patient message: ${userMessage}\nAI draft reply: ${aiDraftReply}`;

    try {
      const result = await Promise.race([
        this.groqService.generateChatResponse([
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ]),
        new Promise<null>((_, reject) =>
          setTimeout(
            () => reject(new Error("Comprehension classify timeout")),
            CLASSIFY_TIMEOUT_MS,
          ),
        ),
      ]);
      return this.parseResponse(result);
    } catch (error) {
      this.logger.warn(
        `Comprehension classifier failed — defaulting to understood: ${(error as Error).message}`,
      );
      // Fail-open: infrastructure hiccups should never escalate.
      return "understood";
    }
  }

  /** Maps the LLM's free-text response to the classifier enum. */
  private parseResponse(response: string | null): ComprehensionResult {
    if (!response) return "understood";
    const cleaned = response.trim().toUpperCase();
    if (cleaned.includes("UNCLEAR")) return "unclear";
    return "understood";
  }
}
