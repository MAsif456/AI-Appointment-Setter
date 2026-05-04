import { Injectable, Logger } from "@nestjs/common";
import { InjectionDetectorService } from "./injection-detector.service";
import { ContentSanitiserService } from "./content-sanitiser.service";
import { OutputValidatorService } from "./output-validator.service";
import { SecurityLoggerService } from "./security-logger.service";
import {
  SecurityResult,
  OutputValidationResult,
  PHASE_FALLBACKS,
  INPUT_LIMITS,
  MAX_INJECTION_ATTEMPTS,
  THREAT_THRESHOLDS,
} from "./security.types";

// Ref: OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection
// https://genai.owasp.org/llmrisk/llm01-prompt-injection/
// Defense-in-depth: input validation → injection detection → sanitisation → output validation.
// Single service orchestrates the pipeline — injectable into both webhook (orchestrator)
// and frontend (conversations service) paths without coupling to HTTP context.

@Injectable()
export class SecurityPipelineService {
  private readonly logger = new Logger(SecurityPipelineService.name);

  /**
   * Constructor for SecurityPipelineService.
   *
   * @param injectionDetector - Service for detecting potential security threats in a given message.
   * @param contentSanitiser - Service for sanitising messages based on security flags.
   * @param outputValidator - Service for validating the safety of AI responses.
   * @param securityLogger - Service for logging security-related events.
   */
  constructor(
    private readonly injectionDetector: InjectionDetectorService,
    private readonly contentSanitiser: ContentSanitiserService,
    private readonly outputValidator: OutputValidatorService,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  /**
   * Process an inbound message through the security pipeline.
   *
   * [1] Input validation: empty / oversized messages
   * [2] Injection detection: pattern matching + heuristic scoring
   * [3] Content sanitisation: always runs regardless of threat score
   *
   * Handles based on threat score thresholds:
   * - block: threat score >= THREAT_THRESHOLDS.BLOCK
   * - sanitise: threat score >= THREAT_THRESHOLDS.SANITISE
   * - pass: threat score < THREAT_THRESHOLDS.SANITISE
   *
   * @param message - The message to process through the security pipeline.
   * @param conversationId - The conversation ID of the message.
   * @param clinicId - The clinic ID of the message.
   * @param conversationPhase - The phase of the conversation the message is in (optional).
   * @param leadId - The lead ID of the message (optional).
   * @returns A promise that resolves to a SecurityResult object containing the processed message, threat score, flags, and fallback response.
   */
  async processInbound(
    message: string,
    conversationId: string,
    clinicId: string,
    conversationPhase?: string,
    leadId?: string,
  ): Promise<SecurityResult> {
    // [1] Input validation — empty / oversized messages
    if (!message || message.trim().length === 0) {
      return {
        allowed: false,
        sanitisedMessage: "",
        threatScore: 0,
        flags: [],
        fallbackResponse: INPUT_LIMITS.EMPTY_RESPONSE,
      };
    }

    let processedMessage = message;
    if (processedMessage.length > INPUT_LIMITS.MAX_LENGTH) {
      processedMessage = processedMessage.substring(0, INPUT_LIMITS.MAX_LENGTH);
    }

    // Rate-based escalation: 3+ prior injection attempts → restrict to fallback-only
    // Ref: persistent attackers iterate; the pattern of repeated attempts is itself a signal
    try {
      const currentCount =
        await this.securityLogger.getInjectionCount(conversationId);
      if (currentCount >= MAX_INJECTION_ATTEMPTS) {
        this.logger.warn(
          `Rate-limited conversation ${conversationId} — ${currentCount} prior injection attempts`,
        );
        await this.securityLogger.logEvent({
          eventType: "rate_limited",
          threatScore: 1.0,
          flags: ["rate_limit_exceeded"],
          originalMessage: processedMessage,
          conversationId,
          clinicId,
          timestamp: new Date(),
          action: "block",
        });
        return {
          allowed: false,
          sanitisedMessage: processedMessage,
          threatScore: 1.0,
          flags: [],
          fallbackResponse:
            PHASE_FALLBACKS[conversationPhase ?? ""] ??
            PHASE_FALLBACKS["default"],
        };
      }
    } catch {
      // DB lookup failure should never block a patient — fail-open
    }

    // [2] Injection detection — pattern matching + heuristic scoring
    // Wrapped in try/catch: fail-open design for availability.
    // A booking chatbot should never silently drop a patient message.
    let detection;
    try {
      detection = this.injectionDetector.detect(processedMessage);
    } catch (error) {
      this.logger.error(
        `Injection detector failed — passing message through: ${(error as Error).message}`,
      );
      return {
        allowed: true,
        sanitisedMessage: this.contentSanitiser.sanitise(processedMessage),
        threatScore: 0,
        flags: [],
      };
    }

    // [3] Content sanitisation — always runs regardless of threat score
    const sanitisedMessage = this.contentSanitiser.sanitise(processedMessage);

    // Handle based on threat score thresholds
    if (detection.action === "block") {
      const flags = detection.flags.map((f) => f.pattern);
      await this.securityLogger.logEvent({
        eventType: "injection_blocked",
        threatScore: detection.threatScore,
        flags,
        originalMessage: message,
        sanitisedMessage,
        conversationId,
        clinicId,
        timestamp: new Date(),
        action: "block",
      });
      await this.securityLogger.flagConversation(
        conversationId,
        "prompt_injection_detected",
      );
      await this.securityLogger.incrementInjectionCount(conversationId);

      if (leadId) {
        await this.securityLogger.persistAuditMessage(
          conversationId,
          clinicId,
          leadId,
          `[SECURITY] Prompt injection blocked — score: ${detection.threatScore.toFixed(2)}, rules: ${flags.join(", ")}`,
        );
      }

      return {
        allowed: false,
        sanitisedMessage,
        threatScore: detection.threatScore,
        flags: detection.flags,
        fallbackResponse:
          PHASE_FALLBACKS[conversationPhase ?? ""] ??
          PHASE_FALLBACKS["default"],
      };
    }

    if (detection.action === "sanitise") {
      const flags = detection.flags.map((f) => f.pattern);
      await this.securityLogger.logEvent({
        eventType: "message_sanitised",
        threatScore: detection.threatScore,
        flags,
        originalMessage: message,
        sanitisedMessage,
        conversationId,
        clinicId,
        timestamp: new Date(),
        action: "sanitise",
      });

      return {
        allowed: true,
        sanitisedMessage,
        threatScore: detection.threatScore,
        flags: detection.flags,
      };
    }

    // Low or zero threat — pass through with sanitised content
    if (detection.threatScore > 0) {
      await this.securityLogger.logEvent({
        eventType: "injection_detected",
        threatScore: detection.threatScore,
        flags: detection.flags.map((f) => f.pattern),
        originalMessage: message,
        sanitisedMessage,
        conversationId,
        clinicId,
        timestamp: new Date(),
        action: "pass",
      });
    }

    return {
      allowed: true,
      sanitisedMessage,
      threatScore: detection.threatScore,
      flags: detection.flags,
    };
  }

  /**
   * Validate a response from the AI against various threat categories.
   *
   * @param response The response from the AI to validate.
   * @param conversationPhase The conversation phase associated with the response (optional).
   * @returns An object containing a boolean "safe" flag and an array of threat categories.
   *
   * OWASP LLM07 — output validation is the safety net when input filtering fails
   * Even if an injection bypasses input detection, the response is caught before reaching the patient
   */
  validateOutput(
    response: string,
    conversationPhase?: string,
  ): OutputValidationResult {
    return this.outputValidator.validate(response, conversationPhase);
  }
}
