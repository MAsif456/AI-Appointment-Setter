import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
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
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
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

  /** Returns auth + version headers for GHL API requests. */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.configService.get<string>("GHL_PRIVATE_TOKEN")}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
    };
  }

  /**
   * Sends a message to the GHL API with retry and circuit breaker protection.
   * Uses exponential backoff with full jitter to prevent thundering herd.
   *
   * @param {SendMessageDto} dto - The message to send.
   * @returns {Promise<any>} - The result of the message send.
   */
  async sendMessageWithRetry(dto: SendMessageDto): Promise<any> {
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
    if (dto.type === "Email") {
      payload.html = dto.html ?? dto.message;
      payload.subject = dto.subject ?? "AppointHealth";
    } else {
      payload.message = dto.message;
    }

    return this.messagingCircuitBreaker.execute(() =>
      retryWithBackoff(
        async () => {
          const { data } = await lastValueFrom(
            this.httpService.post("/conversations/messages", payload, {
              headers: this.getHeaders(),
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

  /** Fetches a conversation from GHL by its ID. */
  async getConversation(conversationId: string): Promise<any> {
    const { data } = await lastValueFrom(
      this.httpService.get(`/conversations/${conversationId}`, {
        headers: this.getHeaders(),
      }),
    );
    return data;
  }

  /** Creates a new GHL conversation for a contact at a location. */
  async createConversation(
    contactId: string,
    locationId: string,
  ): Promise<any> {
    const { data } = await lastValueFrom(
      this.httpService.post(
        "/conversations/",
        { contactId, locationId },
        { headers: this.getHeaders() },
      ),
    );
    return data;
  }

  /** Creates an appointment in the GHL Calendar (circuit-breaker protected). */
  async createAppointment(
    calendarId: string,
    locationId: string,
    contactId: string,
    startTime: string,
    endTime: string,
  ): Promise<any> {
    return this.appointmentCircuitBreaker.execute(async () => {
      const { data } = await lastValueFrom(
        this.httpService.post(
          "/calendars/events/appointments",
          {
            calendarId,
            locationId,
            contactId,
            startTime,
            endTime,
            appointmentStatus: "confirmed",
          },
          { headers: this.getHeaders() },
        ),
      );
      return data;
    });
  }

  /** Returns the current state of each GHL circuit breaker for health monitoring. */
  getCircuitBreakerStates(): Record<string, CircuitState> {
    return {
      messaging: this.messagingCircuitBreaker.getState(),
      appointments: this.appointmentCircuitBreaker.getState(),
    };
  }

  /**
   * Deletes (cancels) an appointment in GHL via the Delete Event endpoint.
   * @param {string} eventId - The GHL calendar event ID.
   * @returns {Promise<any | null>} - The response data, or null on failure.
   */
  async cancelAppointment(eventId: string): Promise<any | null> {
    try {
      const { data } = await lastValueFrom(
        this.httpService.delete(`/calendars/events/${eventId}`, {
          headers: this.getHeaders(),
        }),
      );
      return data;
    } catch (error) {
      this.logger.error(
        `GHL cancel appointment failed for eventId: ${eventId}`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Adds a tag to a contact in GHL.
   * @param {string} contactId - The GHL contact ID.
   * @param {string} tag - The tag to add.
   * @returns {Promise<any | null>} - The response data, or null on failure.
   */
  async addContactTag(contactId: string, tag: string): Promise<any | null> {
    try {
      const { data } = await lastValueFrom(
        this.httpService.post(
          `/contacts/${contactId}/tags`,
          { tags: [tag] },
          { headers: this.getHeaders() },
        ),
      );
      return data;
    } catch (error) {
      this.logger.warn(
        `GHL add tag '${tag}' skipped for contact ${contactId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Removes a tag from a contact in GHL.
   * @param {string} contactId - The GHL contact ID.
   * @param {string} tag - The tag to remove.
   * @returns {Promise<any | null>} - The response data, or null on failure.
   */
  async removeContactTag(contactId: string, tag: string): Promise<any | null> {
    try {
      const { data } = await lastValueFrom(
        this.httpService.delete(`/contacts/${contactId}/tags`, {
          headers: this.getHeaders(),
          data: { tags: [tag] },
        }),
      );
      return data;
    } catch (error) {
      this.logger.warn(
        `GHL remove tag '${tag}' skipped for contact ${contactId}: ${error.message}`,
      );
      return null;
    }
  }
}
