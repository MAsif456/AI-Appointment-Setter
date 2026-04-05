import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Service for sending messages via GoHighLevel (GHL) API
 * Handles external API communication only
 * Message recording is done by MessagesService from ghl folder
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly ghlApiUrl: string;
  private readonly ghlApiKey: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.ghlApiUrl =
      this.configService.get<string>('GHL_API_URL') ||
      'https://rest.gohighlevel.com/v1';
    this.ghlApiKey = this.configService.get<string>('GHL_API_KEY') || '';
  }

  /**
   * Send a message to a contact via GHL API
   * Implements retry logic with exponential backoff
   */
  async sendMessage(contactId: string, message: string): Promise<boolean> {
    if (!contactId) {
      this.logger.error('Cannot send message: contactId is missing');
      return false;
    }

    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(
            `${this.ghlApiUrl}/conversations/messages`,
            {
              contactId,
              message,
              type: 'SMS',
            },
            {
              headers: {
                Authorization: `Bearer ${this.ghlApiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            },
          ),
        );

        if (response.status === 200 || response.status === 201) {
          this.logger.log(`Message sent successfully to contact ${contactId}`);
          return true;
        }

        this.logger.warn(
          `Unexpected response status ${response.status}`,
        );
        return false;
      } catch (error) {
        attempt++;

        this.logger.error(
          `Send failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
        );

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        } else {
          this.logger.error(`Max retries exceeded for ${contactId}`);
          return false;
        }
      }
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}