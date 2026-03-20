import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class GhlApiService {
  private readonly logger = new Logger(GhlApiService.name);
  private readonly maxRetries = 3;

  /**
   * Constructs a GhlApiService instance.
   *
   * @param {HttpService} httpService - The HTTP service to use for making requests.
   * @param {ConfigService} configService - The ConfigService to use for getting configuration values.
   */
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

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
  }
}
