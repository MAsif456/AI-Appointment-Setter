import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { SendMessageDto } from './dto/send-message.dto';
import { CircuitBreaker } from './circuit-breaker';

@Injectable()
export class GhlApiService {
  private readonly logger = new Logger(GhlApiService.name);
  private readonly maxRetries = 3;
  private readonly appointmentCircuitBreaker: CircuitBreaker;

  /**
   * Constructs a GhlApiService instance.
   * Initialises a circuit breaker for appointment creation calls to protect
   * against cascading failures when the GHL API is unresponsive.
   *
   * @param {HttpService} httpService - The HTTP service to use for making requests.
   * @param {ConfigService} configService - The ConfigService to use for getting configuration values.
   */
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.appointmentCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      name: 'GHL-Appointments',
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
      Authorization: `Bearer ${this.configService.get<string>('GHL_PRIVATE_TOKEN')}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Sends a message to the GHL API with retry.
   *
   * @param {SendMessageDto} dto - The message to send.
   *
   * @returns {Promise<any>} - The result of the message send.
   *
   * The function will retry up to `maxRetries` times if the request fails.
   * If all retries fail, the function will throw an error.
   */
  async sendMessageWithRetry(dto: SendMessageDto): Promise<any> {
    const payload = {
      type: dto.type,
      contactId: dto.contactId,
      message: dto.message,
      status: 'pending',
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const { data } = await lastValueFrom(
          this.httpService.post('/conversations/messages', payload, {
            headers: this.getHeaders(),
          }),
        );
        return data;
      } catch (error) {
        if (attempt === this.maxRetries) {
          this.logger.error(
            `GHL send failed after ${this.maxRetries} attempts`,
            {
              contactId: dto.contactId,
              message: dto.message,
              error: error.message,
            },
          );
          throw error;
        }
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(
          `GHL send attempt ${attempt} failed, retrying in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
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
        '/conversations/',
        { contactId, locationId },
        { headers: this.getHeaders() },
      ),
    );
    return data;
  }

  /**
   * Cancels an appointment in the GHL Calendar by its GHL appointment ID.
   * Throws on failure so the caller can decide whether to proceed.
   */
  async cancelAppointment(appointmentId: string): Promise<void> {
    await lastValueFrom(
      this.httpService.delete(`/calendars/events/appointments/${appointmentId}`, {
        headers: this.getHeaders(),
      }),
    ).catch((error) => {
      this.logger.error(`Cancel appointment ${appointmentId} failed: ${(error as Error).message}`);
      throw error;
    });
  }

  /**
   * Adds one or more tags to a GHL contact.
   * Errors are logged and re-thrown so callers can handle non-critical failures gracefully.
   */
  async addContactTag(contactId: string, tags: string[]): Promise<void> {
    await lastValueFrom(
      this.httpService.post(`/contacts/${contactId}/tags`, { tags }, { headers: this.getHeaders() }),
    ).catch((error) => {
      this.logger.error(`Add tags to contact ${contactId} failed: ${(error as Error).message}`);
      throw error;
    });
  }

  /**
   * Updates a single custom field on a GHL contact.
   * Errors are logged and re-thrown so callers can handle non-critical failures gracefully.
   */
  async updateContactCustomField(contactId: string, fieldKey: string, fieldValue: string): Promise<void> {
    await lastValueFrom(
      this.httpService.put(
        `/contacts/${contactId}`,
        { customFields: [{ key: fieldKey, value: fieldValue }] },
        { headers: this.getHeaders() },
      ),
    ).catch((error) => {
      this.logger.error(`Update custom field ${fieldKey} for contact ${contactId} failed: ${(error as Error).message}`);
      throw error;
    });
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
          '/calendars/events/appointments',
          {
            calendarId,
            locationId,
            contactId,
            startTime,
            endTime,
            appointmentStatus: 'confirmed',
          },
          { headers: this.getHeaders() },
        ),
      );
      return data;
    });
  }
}
