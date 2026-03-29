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

  /** Initialises HTTP client and circuit breaker for GHL API calls. */
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

  /** Returns auth + version headers for GHL API requests. */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.configService.get<string>('GHL_PRIVATE_TOKEN')}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    };
  }

  /** Sends a message via GHL with exponential-backoff retry (up to maxRetries). */
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
        '/conversations/',
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

  /**
   * Deletes (cancels) an appointment in GHL via the Delete Event endpoint.
   * @param {string} eventId - The GHL calendar event ID.
   * @returns {Promise<any | null>} - The response data, or null on failure.
   */
  async cancelAppointment(eventId: string): Promise<any | null> {
    try {
      const { data } = await lastValueFrom(
        this.httpService.delete(
          `/calendars/events/${eventId}`,
          { headers: this.getHeaders() },
        ),
      );
      return data;
    } catch (error) {
      this.logger.error(`GHL cancel appointment failed for eventId: ${eventId}`, error.message);
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
      this.logger.warn(`GHL add tag '${tag}' skipped for contact ${contactId}: ${error.message}`);
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
        this.httpService.delete(
          `/contacts/${contactId}/tags`,
          { headers: this.getHeaders(), data: { tags: [tag] } },
        ),
      );
      return data;
    } catch (error) {
      this.logger.warn(`GHL remove tag '${tag}' skipped for contact ${contactId}: ${error.message}`);
      return null;
    }
  }
}
