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

  /**
   * Gets the HTTP headers required for making requests to the GHL API.
   *
   * The headers include the GHL private token, the API version, and the content type.
   *
   * @returns {Record<string, string>} - The HTTP headers.
   */
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
    const payload = {
      type: dto.type,
      contactId: dto.contactId,
      message: dto.message,
      status: "pending",
    };

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

  /**
   * Fetches a conversation from the GHL API by its ID.
   * @param {string} conversationId - The ID of the conversation to fetch.
   * @returns {Promise<any>} - A promise that resolves with the conversation data.
   * @throws {AxiosError} - If the request fails.
   */
  async getConversation(conversationId: string): Promise<any> {
    const { data } = await lastValueFrom(
      this.httpService.get(`/conversations/${conversationId}`, {
        headers: this.getHeaders(),
      }),
    );
    return data;
  }

  /**
   * Creates a new conversation with the given contact and location IDs.
   *
   * @param {string} contactId - The ID of the contact to create the conversation for.
   * @param {string} locationId - The ID of the location to create the conversation for.
   * @returns {Promise<any>} - A promise that resolves with the created conversation data.
   */
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

  /**
   * Creates an appointment in the GHL Calendar.
   *
   * @param {string} calendarId - The GHL calendar ID.
   * @param {string} locationId - The GHL location ID.
   * @param {string} contactId - The GHL contact ID.
   * @param {string} startTime - ISO 8601 start time.
   * @param {string} endTime - ISO 8601 end time.
   * @returns {Promise<any>} - The created appointment data from GHL.
   */
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
}
