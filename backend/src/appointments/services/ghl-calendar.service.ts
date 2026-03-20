import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }),
      );

      this.logger.log(`Received ${response.data.slots?.length || 0} slots from GHL`);
      return response.data.slots || [];
    } catch (error) {
      this.logger.error(`Failed to fetch slots from GHL: ${error.message}`);
      throw error;
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