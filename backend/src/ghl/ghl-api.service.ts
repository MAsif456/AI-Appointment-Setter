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
    // GHL API requires locationId to identify which sub-account this request is for.
    const payload: Record<string, string> = {
      type: dto.type,
      contactId: dto.contactId,
      status: "pending",
    };
    if (dto.locationId) {
      payload.locationId = dto.locationId;
    }
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
              (error as any).response?.data,
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
   * @param {string} contactId - The GHL contact ID.
   * @param {string} fieldKey - Custom field key (e.g., 'escalation_reason').
   * @param {string} fieldValue - Value to set for the custom field.
   * @param {string} [locationId] - GHL Location ID (required by GHL API for all contact updates).
   */
  async updateContactCustomField(apiKey: string, contactId: string, fieldKey: string, fieldValue: string, locationId?: string): Promise<void> {
    await lastValueFrom(
      this.httpService.put(
        `/contacts/${contactId}`,
        { customFields: [{ key: fieldKey, field_value: fieldValue }] },
        { headers: this.buildHeaders(apiKey) },
      ),
    ).catch((error) => {
      this.logger.error(`Update custom field ${fieldKey} for contact ${contactId} failed:`, {
        status: (error as any).response?.status,
        data: (error as any).response?.data,
        locationId,
      });
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
      { scope: 'conversations.readonly',           url: `/conversations/?locationId=${locationId}&limit=1` },
      { scope: 'conversations.write',              url: `/conversations/?locationId=${locationId}&limit=1` },
      { scope: 'conversations/message.write',      url: `/conversations/?locationId=${locationId}&limit=1` },
      { scope: 'conversations/message.readonly',   url: `/conversations/?locationId=${locationId}&limit=1` },
      { scope: 'calendars.readonly',               url: `/calendars/?locationId=${locationId}` },
      { scope: 'calendars.write',                  url: `/calendars/?locationId=${locationId}` },
      { scope: 'calendars/events.write',           url: `/calendars/events/appointments?locationId=${locationId}&startTime=1&endTime=1` },
      { scope: 'calendars/events.readonly',        url: `/calendars/events/appointments?locationId=${locationId}&startTime=1&endTime=1` },
      { scope: 'calendars/groups.readonly',        url: `/calendars/groups?locationId=${locationId}` },
      { scope: 'calendars/resources.readonly',     url: `/calendars/resources?locationId=${locationId}` },
      { scope: 'calendars/groups.write',           url: `/calendars/groups?locationId=${locationId}` },
      { scope: 'calendars/resources.write',        url: `/calendars/resources?locationId=${locationId}` },
      { scope: 'contacts.readonly',                url: `/contacts/?locationId=${locationId}&limit=1` },
      { scope: 'contacts.write',                   url: `/contacts/?locationId=${locationId}&limit=1` },
      { scope: 'locations.readonly',               url: `/locations/${locationId}` },
      { scope: 'locations/customFields.readonly',  url: `/locations/${locationId}/customFields` },
      { scope: 'locations/customFields.write',     url: `/locations/${locationId}/customFields` },
      { scope: 'locations/customValues.readonly',  url: `/locations/${locationId}/customValues` },
      { scope: 'locations/customValues.write',     url: `/locations/${locationId}/customValues` },
      { scope: 'socialplanner/oauth.readonly',     url: `/social-media-posting/oauth/facebook/locations/${locationId}/accounts` },
      { scope: 'socialplanner/oauth.write',        url: `/social-media-posting/oauth/facebook/locations/${locationId}/accounts` },
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
          'In GoHighLevel go to Settings → Integrations → Private Integrations and enable ALL of:\n' +
          '  • conversations.readonly\n' +
          '  • conversations.write\n' +
          '  • conversations/message.write\n' +
          '  • conversations/message.readonly\n' +
          '  • calendars.readonly\n' +
          '  • calendars.write\n' +
          '  • calendars/events.write\n' +
          '  • calendars/events.readonly\n' +
          '  • calendars/groups.readonly\n' +
          '  • calendars/groups.write\n' +
          '  • calendars/resources.readonly\n' +
          '  • calendars/resources.write\n' +
          '  • contacts.readonly\n' +
          '  • contacts.write\n' +
          '  • locations.readonly\n' +
          '  • locations/customFields.readonly\n' +
          '  • locations/customFields.write\n' +
          '  • locations/customValues.readonly\n' +
          '  • locations/customValues.write\n' +
          '  • socialplanner/oauth.readonly\n' +
          '  • socialplanner/oauth.write',
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
