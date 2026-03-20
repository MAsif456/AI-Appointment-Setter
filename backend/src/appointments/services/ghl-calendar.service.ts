import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';

export interface GHLSlot {
  id: string;
  startTime: string; // ISO string
  endTime: string;
  available: boolean;
}

@Injectable()
export class GHLCalendarService {
  private readonly logger = new Logger(GHLCalendarService.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Fetch available slots from GHL Calendar API
   * @param calendarId - GHL Calendar ID
   * @param startDate - Start date for slot search
   * @param endDate - End date for slot search
   * @param apiKey - GHL API key
   * @returns Array of available slots
   */
  async fetchAvailableSlots(
    calendarId: string,
    startDate: Date,
    endDate: Date,
    apiKey: string,
  ): Promise<GHLSlot[]> {
    try {
      this.logger.log(`Fetching slots for calendar ${calendarId} from ${startDate} to ${endDate}`);

      // GHL Calendar API endpoint (replace with actual GHL API)
      const url = `https://rest.gohighlevel.com/v1/calendars/${calendarId}/slots`;

      const response = await firstValueFrom(
        this.httpService
          .get(url, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            params: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
          })
          .pipe(timeout(10000)), // Set timeout for API call
      );

      const slots = response.data?.slots || [];

      this.logger.log(`Received ${slots.length} slots from GHL`);
      return slots;
    } catch (error) {

      // Handle timeout separately
      if (error.name === 'TimeoutError') {
        this.logger.error('GHL API timeout after 10 seconds');
        return [];
      }

      // Handle general API errors
      this.logger.error(`Failed to fetch slots from GHL: ${error.message}`);
      return [];
    }
  }

  /**
   * Create appointment in GHL Calendar
   */
  async createAppointment(
    calendarId: string,
    contactId: string,
    slotId: string,
    apiKey: string,
  ): Promise<{ appointmentId: string }> {
    try {
      const url = `https://rest.gohighlevel.com/v1/calendars/${calendarId}/appointments`;

      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            contactId,
            slotId,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return { appointmentId: response.data.id };
    } catch (error) {
      this.logger.error(`Failed to create appointment: ${error.message}`);
      throw error;
    }
  }
}