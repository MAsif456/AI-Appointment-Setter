import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../database/schemas/conversation.schema";
import { Message, MessageDocument } from "../database/schemas/message.schema";
import {
  SecurityLogEntry,
  SecurityEventType,
  SecurityAction,
  SecurityFlag,
} from "./security.types";

// Structured security logging with conversation flagging and audit trail.
// Logs are JSON-serializable for SIEM integration.
// Ref: OWASP LLM01 — continuous monitoring, track injection attempts, integrate alerts
// https://genai.owasp.org/llmrisk/llm01-prompt-injection/

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger("SecurityPipeline");

  /**
   * Constructor for SecurityLoggerService.
   * @param conversationModel - Mongoose model for conversations.
   * @param messageModel - Mongoose model for messages.
   */
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  /**
   * Logs a security event with structured metadata for log aggregation tools.
   * @param entry - A SecurityLogEntry object with event type, action, threat score, flags, conversation ID, and clinic ID.
   */
  async logEvent(entry: SecurityLogEntry): Promise<void> {
    // Structured log output — JSON-friendly for log aggregation tools
    this.logger.warn(
      `[${entry.eventType}] action=${entry.action} score=${entry.threatScore.toFixed(2)} ` +
        `flags=[${entry.flags.join(",")}] conversationId=${entry.conversationId} ` +
        `clinicId=${entry.clinicId}`,
    );

    if (entry.action === "block" || entry.action === "sanitise") {
      this.logger.warn(
        `[${entry.eventType}] originalMessage="${entry.originalMessage.substring(0, 200)}"` +
          (entry.sanitisedMessage
            ? ` sanitised="${entry.sanitisedMessage.substring(0, 200)}"`
            : ""),
      );
    }
  }

  /**
   * Flags a conversation for review.
   * @param conversationId - The conversation ID to flag.
   * @param reason - The reason for flagging the conversation.
   * @returns A promise that resolves when the conversation is flagged.
   * @throws An error is logged to the security logger if the flag operation fails.
   */
  async flagConversation(
    conversationId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.conversationModel.findByIdAndUpdate(
        new Types.ObjectId(conversationId),
        {
          flaggedForReview: true,
          flaggedAt: new Date(),
          flagReason: reason,
        },
      );
    } catch (error) {
      // Logging failure should never break the message pipeline
      this.logger.error(
        `Failed to flag conversation ${conversationId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Increments the injection attempt count for a conversation.
   * @param conversationId - The conversation ID to increment the count for.
   * @returns A promise that resolves to the updated injection attempt count.
   * @throws Logs an error if the increment operation fails.
   */
  async incrementInjectionCount(conversationId: string): Promise<number> {
    try {
      const updated = await this.conversationModel.findByIdAndUpdate(
        new Types.ObjectId(conversationId),
        { $inc: { injectionAttemptCount: 1 } },
        { new: true },
      );
      return updated?.injectionAttemptCount ?? 0;
    } catch (error) {
      this.logger.error(
        `Failed to increment injection count for ${conversationId}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Retrieves the current injection attempt count for a conversation.
   * @param conversationId - The conversation ID to retrieve the count for.
   * @returns A promise that resolves to the current injection attempt count (0 if not found).
   */
  async getInjectionCount(conversationId: string): Promise<number> {
    try {
      const conversation = await this.conversationModel
        .findById(new Types.ObjectId(conversationId))
        .select("injectionAttemptCount");
      return conversation?.injectionAttemptCount ?? 0;
    } catch {
      return 0;
    }
  }

  // Persist a system message for audit trail — visible in conversation history
  async persistAuditMessage(
    conversationId: string,
    clinicId: string,
    leadId: string,
    content: string,
  ): Promise<void> {
    try {
      await this.messageModel.create({
        conversationId: new Types.ObjectId(conversationId),
        clinicId: new Types.ObjectId(clinicId),
        leadId: new Types.ObjectId(leadId),
        sender: "system",
        content,
        channel: "sms",
        status: "sent",
        isAbusive: false,
        isFallback: false,
        isFollowUp: false,
        isReminder: false,
        retryCount: 0,
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist audit message: ${(error as Error).message}`,
      );
    }
  }
}
