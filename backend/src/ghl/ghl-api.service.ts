import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { SendMessageDto } from "./dto/send-message.dto";
import { CircuitBreaker, CircuitState } from "./circuit-breaker";
import { retryWithBackoff } from "../common/retry-utils";

@Injectable()
export class GhlApiService {
  private readonly logger = new Logger(GhlApiService.name);
  private readonly messagingCircuitBreaker: CircuitBreaker;
  private readonly appointmentCircuitBreaker: CircuitBreaker;

  /**
   * Constructs a GhlApiService instance.
   * Initialises per-service circuit breakers to protect against cascading
   * failures when the GHL API is unresponsive.
   *
   * Ref: Nygard, M. (2018). Release It! Design and Deploy Production-Ready Software, 2nd ed.
   *   Pragmatic Bookshelf, Ch. 4: "Circuit Breaker" stability pattern.
   */
  constructor(private readonly httpService: HttpService) {
    this.messagingCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      name: "GHL-Messaging",
    });
    this.appointmentCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      name: "GHL-Appointments",
    });
  }

  /** Returns auth + version headers for a given API key. */
  private buildHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
    };
  }

  /**
   * Sends a message to the GHL API with retry and circuit breaker protection.
   * Uses exponential backoff with full jitter to prevent thundering herd.
   *
   * @param {string} apiKey - The per-clinic GHL private integration token.
   * @param {SendMessageDto} dto - The message to send.
   * @returns {Promise<any>} - The result of the message send.
   */
  async sendMessageWithRetry(apiKey: string, dto: SendMessageDto): Promise<any> {
    // Ref: GHL Conversations API — Send a New Message. Email type uses html + subject, others use message.
    // conversationId threads messages into the same GHL conversation (critical for email threading).
    const payload: Record<string, string> = {
      type: dto.type,
      contactId: dto.contactId,
      status: "pending",
    };
    if (dto.conversationId) {
      payload.conversationId = dto.conversationId;
    }
    if (dto.emailMessageId) {
      payload.emailMessageId = dto.emailMessageId;
    }
    if (dto.type === "Email") {
      payload.html = dto.html ?? dto.message;
      if (dto.subject) payload.subject = dto.subject;
    } else {
      payload.message = dto.message;
    }

    this.logger.debug(
      `GHL send — type: ${payload.type}, contactId: ${dto.contactId}, conversationId: ${payload.conversationId ?? 'none'}`,
    );

    return this.messagingCircuitBreaker.execute(() =>
      retryWithBackoff(
        async () => {
          const { data } = await lastValueFrom(
            this.httpService.post("/conversations/messages", payload, {
              headers: this.buildHeaders(apiKey),
            }),
          );
          return data;
        },
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 4000,
          onRetry: (attempt, error, delayMs) => {
            this.logger.warn(
              `GHL send attempt ${attempt} failed — contactId: ${dto.contactId}, ` +
                `retrying in ${Math.round(delayMs)}ms. Error: ${error.message}`,
            );
          },
        },
      ),
    );
  }

  /**
   * Fetches a conversation from GHL by its ID.
   * @param {string} apiKey - The per-clinic GHL private integration token.
   */
  async getConversation(apiKey: string, conversationId: string): Promise<any> {
    const { data } = await lastValueFrom(
      this.httpService.get(`/conversations/${conversationId}`, {
        headers: this.buildHeaders(apiKey),
      }),
    );
    return data;
  }

  /**
   * Creates a new GHL conversation for a contact at a location.
   * @param {string} apiKey - The per-clinic GHL private integration token.
   */
  async createConversation(
    apiKey: string,
    contactId: string,
    locationId: string,
  ): Promise<any> {
    const { data } = await lastValueFrom(
      this.httpService.post(
        "/conversations/",
        { contactId, locationId },
        { headers: this.buildHeaders(apiKey) },
      ),
    );
    return data;
  }

  /**
   * Cancels an appointment in the GHL Calendar by its GHL appointment ID.
   * Uses PUT with appointmentStatus "cancelled" (GHL API v2 cancel pattern).
   * Returns the response data, or null on failure.
   *
   * @param {string} apiKey - The per-clinic GHL private integration token.
   */
  async cancelAppointment(apiKey: string, appointmentId: string): Promise<any | null> {
    try {
      const { data } = await lastValueFrom(
        this.httpService.put(
          `/calendars/events/appointments/${appointmentId}`,
          { appointmentStatus: 'cancelled' },
          { headers: this.buildHeaders(apiKey) },
        ),
      );
      return data;
    } catch (error) {
      this.logger.error(`Cancel appointment ${appointmentId} failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Adds a tag to a GHL contact.
   * Returns the response data, or null on failure.
   *
   * @param {string} apiKey - The per-clinic GHL private integration token.
   */
  async addContactTag(apiKey: string, contactId: string, tag: string): Promise<any | null> {
    try {
      const { data } = await lastValueFrom(
        this.httpService.post(`/contacts/${contactId}/tags`, { tags: [tag] }, { headers: this.buildHeaders(apiKey) }),
      );
      return data;
    } catch (error) {
      this.logger.error(`Add tag to contact ${contactId} failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Removes a tag from a contact in GHL.
   *
   * @param {string} apiKey - The per-clinic GHL private integration token.
   * @param {string} contactId - The GHL contact ID.
   * @param {string} tag - The tag to remove.
   * @returns {Promise<any | null>} - The response data, or null on failure.
   */
  async removeContactTag(apiKey: string, contactId: string, tag: string): Promise<any | null> {
    try {
      const { data } = await lastValueFrom(
        this.httpService.delete(
          `/contacts/${contactId}/tags`,
          { headers: this.buildHeaders(apiKey), data: { tags: [tag] } },
        ),
      );
      return data;
    } catch (error) {
      this.logger.warn(`GHL remove tag '${tag}' skipped for contact ${contactId}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Updates a single custom field on a GHL contact.
   * Errors are logged and re-thrown so callers can handle non-critical failures gracefully.
   *
   * @param {string} apiKey - The per-clinic GHL private integration token.
   */
  async updateContactCustomField(apiKey: string, contactId: string, fieldKey: string, fieldValue: string): Promise<void> {
    await lastValueFrom(
      this.httpService.put(
        `/contacts/${contactId}`,
        { customFields: [{ key: fieldKey, value: fieldValue }] },
        { headers: this.buildHeaders(apiKey) },
      ),
    ).catch((error) => {
      this.logger.error(`Update custom field ${fieldKey} for contact ${contactId} failed: ${(error as Error).message}`);
      throw error;
    });
  }

  /**
   * Creates an appointment in the GHL Calendar.
   *
   * @param {string} apiKey - The per-clinic GHL private integration token.
   * @param {string} calendarId - The GHL calendar ID.
   * @param {string} locationId - The GHL location ID.
   * @param {string} contactId - The GHL contact ID.
   * @param {string} startTime - ISO 8601 start time.
   * @param {string} endTime - ISO 8601 end time.
   * @returns {Promise<any>} - The created appointment data from GHL.
   */
  async createAppointment(
    apiKey: string,
    calendarId: string,
    locationId: string,
    contactId: string,
    startTime: string,
    endTime: string,
  ): Promise<any> {
    const payload = {
      calendarId,
      locationId,
      contactId,
      startTime,
      endTime,
      appointmentStatus: "confirmed",
    };
    this.logger.debug(`Creating GHL appointment: ${JSON.stringify(payload)}`);
    return this.appointmentCircuitBreaker.execute(async () => {
      const { data } = await lastValueFrom(
        this.httpService.post(
          "/calendars/events/appointments",
          payload,
          { headers: this.buildHeaders(apiKey) },
        ),
      );
      return data;
    });
  }

  /**
   * Validates a GHL Private Integration Token (PIT) against a specific location.
   * Returns a result object so callers can surface specific error messages to the user.
   *
   * @param apiKey     - Plaintext GHL private integration token.
   * @param locationId - The GHL location ID the token belongs to.
   */
  async testConnectionWithKey(
    apiKey: string,
    locationId: string,
  ): Promise<{ valid: boolean; errorMessage?: string }> {
    const maskedKey = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '(empty)';
    this.logger.log(`testConnectionWithKey — locationId: "${locationId}", key: ${maskedKey}`);

    if (!apiKey) {
      return { valid: false, errorMessage: 'API key is empty.' };
    }
    if (!locationId) {
      return { valid: false, errorMessage: 'GHL Location ID is not set on this clinic.' };
    }

    // Probe each required scope with a real endpoint to find exactly what's missing.
    // 401/403 = scope missing; 200/404 = scope present (404 just means no data).
    const probes: Array<{ scope: string; url: string }> = [
      { scope: 'conversations.readonly',      url: `/conversations/?locationId=${locationId}&limit=1` },
      { scope: 'conversations.write',         url: `/conversations/?locationId=${locationId}&limit=1` },
      { scope: 'conversations/message.write', url: `/conversations/?locationId=${locationId}&limit=1` },
      { scope: 'calendars.readonly',          url: `/calendars/?locationId=${locationId}` },
      { scope: 'calendars/events.write',      url: `/calendars/events/appointments?locationId=${locationId}&startTime=1&endTime=1` },
      { scope: 'calendars/events.readonly',   url: `/calendars/events/appointments?locationId=${locationId}&startTime=1&endTime=1` },
    ];

    // Deduplicate by URL so we don't make the same HTTP call multiple times
    const uniqueProbes = probes.filter(
      (p, i, arr) => arr.findIndex(x => x.url === p.url) === i,
    );

    const urlStatusMap = new Map<string, number>();

    for (const probe of uniqueProbes) {
      try {
        const response = await lastValueFrom(
          this.httpService.get(probe.url, {
            baseURL: 'https://services.leadconnectorhq.com',
            timeout: 8_000,
            headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' },
            validateStatus: () => true,
          }),
        );
        this.logger.log(`testConnectionWithKey — ${probe.scope}: HTTP ${response.status}`);
        urlStatusMap.set(probe.url, response.status);
      } catch (err) {
        this.logger.error(`testConnectionWithKey — ${probe.scope} probe threw: ${(err as Error).message}`);
        return { valid: false, errorMessage: 'Unable to reach GoHighLevel. Check your internet connection.' };
      }
    }

    // Map each scope back to its probe result
    const missingScopes = probes.filter(p => {
      const status = urlStatusMap.get(p.url);
      return status === 401 || status === 403;
    }).map(p => p.scope);

    if (missingScopes.length > 0) {
      this.logger.warn(`testConnectionWithKey — missing scopes: [${missingScopes.join(', ')}]`);
      return {
        valid: false,
        errorMessage:
          `API key is missing these required scopes: ${missingScopes.join(', ')}.\n` +
          'In GoHighLevel go to Settings → Integrations → Private Integrations and enable AT LEAST:\n' +
          '  • conversations.readonly\n' +
          '  • conversations.write\n' +
          '  • conversations/message.write\n' +
          '  • calendars.readonly\n' +
          '  • calendars/events.write\n' +
          '  • calendars/events.readonly',
      };
    }

    this.logger.log('testConnectionWithKey — all required scopes present, connection valid');
    return { valid: true };
  }

  /** Returns the current state of each GHL circuit breaker for health monitoring. */
  getCircuitBreakerStates(): Record<string, CircuitState> {
    return {
      messaging: this.messagingCircuitBreaker.getState(),
      appointments: this.appointmentCircuitBreaker.getState(),
    };
  }
}
