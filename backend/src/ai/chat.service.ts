import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from './groq.service';
import { GreetingService } from './greeting.service';
import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';
import { buildSystemPrompt, SlotPromptOptions } from './system-prompt-builder';

/** Represents a single message in the chat history */
export interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

/** Optional context passed alongside a message for slot offering */
export interface SendMessageOptions {
  slotOptions?: SlotPromptOptions;
}

/**
 * Manages interactive AI conversations between leads and the booking assistant.
 * Handles greeting generation and multi-turn responses via Groq.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly groqService: GroqService,
    private readonly greetingService: GreetingService,
  ) {}

  /**
   * Starts a new conversation by generating an AI greeting.
   * @param leadInfo - The lead's details
   * @param clinicConfig - The clinic's configuration
   * @returns The AI greeting message, or null on failure
   */
  async startConversation(
    leadInfo: LeadInfo,
    clinicConfig: ClinicConfig,
  ): Promise<string | null> {
    return this.greetingService.generateGreeting(leadInfo, clinicConfig);
  }

  /**
   * Sends a lead's message and gets the AI's reply using full conversation context.
   * @param leadInfo - The lead's details
   * @param clinicConfig - The clinic's configuration
   * @param history - Previous messages in the conversation
   * @param userMessage - The new message from the lead
   * @param options - Optional slot context for slot offering stage
   * @returns The AI response, or null on failure
   */
  async sendMessage(
    leadInfo: LeadInfo,
    clinicConfig: ClinicConfig,
    history: ChatMessage[],
    userMessage: string,
    options?: SendMessageOptions,
  ): Promise<string | null> {
    const systemPrompt = buildSystemPrompt(
      leadInfo,
      clinicConfig,
      options?.slotOptions,
    );

    // Build the full message array for Groq
    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [{ role: 'system', content: systemPrompt }];

    // Add conversation history
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add the new user message
    messages.push({ role: 'user', content: userMessage });

    this.logger.log(
      `Processing message from ${leadInfo.firstName} (${messages.length} messages in context)`,
    );

    return this.groqService.generateChatResponse(messages);
  }
}
