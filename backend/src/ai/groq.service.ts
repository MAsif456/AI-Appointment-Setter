import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Groq from "groq-sdk";
import { CircuitBreaker, CircuitState } from "../ghl/circuit-breaker";

/** Timeout duration for Groq API calls in milliseconds (30 seconds) */
const GROQ_TIMEOUT_MS = 30_000;

/** Llama model used for AI greeting generation */
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Low-level wrapper around the Groq SDK client.
 * Handles client initialisation, API calls, timeout, circuit breaker, and error handling.
 */
@Injectable()
export class GroqService implements OnModuleInit {
  private readonly logger = new Logger(GroqService.name);
  private client: Groq | null = null;
  private readonly aiCircuitBreaker: CircuitBreaker;

  constructor(private readonly configService: ConfigService) {
    this.aiCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      name: "Groq-AI",
    });
  }

  /**
   * Initialises the Groq client on module startup.
   * Logs an error if the API key is missing.
   */
  onModuleInit(): void {
    const apiKey = this.configService.get<string>("GROQ_API_KEY");
    this.logger.log(`Groq API key starts with: ${apiKey?.slice(0, 15)}`);

    if (!apiKey) {
      this.logger.error(
        "GROQ_API_KEY is missing. AI greeting generation will not work.",
      );
      return;
    }

    this.client = new Groq({ apiKey });
    this.logger.log("Groq client initialised successfully.");
  }

  /**
   * Sends a prompt to the Groq API and returns the generated text.
   * Enforces a 30-second timeout via Promise.race().
   * @param prompt - The prompt string to send to the AI
   * @returns The generated text, or null on error/timeout
   */
  async generateResponse(prompt: string): Promise<string | null> {
    if (!this.client) {
      this.logger.error("Groq client is not initialised. Cannot generate.");
      return null;
    }

    try {
      return await this.aiCircuitBreaker.execute(() =>
        Promise.race([this.callGroqApi(prompt), this.createTimeout()]),
      );
    } catch (error) {
      this.logger.error("Groq API error:", error);
      return null;
    }
  }

  /**
   * Sends a multi-turn conversation to the Groq API and returns the response.
   * Protected by circuit breaker and 30-second timeout.
   * @param messages - Array of chat messages with role and content
   * @returns The generated text, or null on error/timeout
   */
  async generateChatResponse(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ): Promise<string | null> {
    if (!this.client) {
      this.logger.error("Groq client is not initialised. Cannot generate.");
      return null;
    }

    try {
      return await this.aiCircuitBreaker.execute(() =>
        Promise.race([this.callGroqChatApi(messages), this.createTimeout()]),
      );
    } catch (error) {
      this.logger.error("Groq chat API error:", error);
      return null;
    }
  }

  /** Returns the current state of the Groq AI circuit breaker for health monitoring. */
  getCircuitBreakerState(): CircuitState {
    return this.aiCircuitBreaker.getState();
  }

  /**
   * Makes the actual chat completion call to the Groq API (single prompt).
   * @param prompt - The prompt to send
   * @returns The generated text content
   */
  private async callGroqApi(prompt: string): Promise<string | null> {
    const response = await this.client!.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 256,
    });

    const content = response.choices?.[0]?.message?.content ?? null;
    return content;
  }

  /**
   * Makes a multi-turn chat completion call to the Groq API.
   * @param messages - The full conversation history
   * @returns The generated text content
   */
  private async callGroqChatApi(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ): Promise<string | null> {
    const response = await this.client!.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 256,
    });

    const content = response.choices?.[0]?.message?.content ?? null;
    return content;
  }

  /**
   * Creates a timeout promise that rejects after GROQ_TIMEOUT_MS.
   * @returns A promise that resolves to null after the timeout
   */
  private createTimeout(): Promise<null> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Groq API timed out after ${GROQ_TIMEOUT_MS}ms`));
      }, GROQ_TIMEOUT_MS);
    });
  }
}
