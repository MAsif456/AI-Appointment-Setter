import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface GHLSlot {
  id: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string (calculated from appointment duration)
  available: boolean;
}

@Injectable()
export class GHLCalendarService {
  private readonly logger = new Logger(GHLCalendarService.name);
  private readonly ghlApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const token = this.configService.get<string>('GHL_PRIVATE_TOKEN')!;

    if (!token) {
      this.logger.error('GHL_PRIVATE_TOKEN not found in environment variables');
      throw new Error('GHL_PRIVATE_TOKEN is required');
    }
    this.ghlApiKey = token;
  }

  /**
   * Fetch available slots from GHL Calendar API
   */
  async fetchAvailableSlots(
    calendarId: string,
    startDate: Date,
    endDate: Date,
    appointmentDuration: number,
  ): Promise<GHLSlot[]> {
    this.logger.log(
      `Fetching slots for calendar ${calendarId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    try {
      // Convert dates to Unix timestamps (milliseconds)
      const startTimestamp = startDate.getTime();
      const endTimestamp = endDate.getTime();

      // Correct GHL endpoint
      const url = `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${this.ghlApiKey}`,
            'Content-Type': 'application/json',
            Version: '2021-07-28',
          },
          params: {
            startDate: startTimestamp,
            endDate: endTimestamp,
          },
          timeout: 10000,
        }),
      );

      this.logger.log(`GHL API Response received`);

      // Parse the response structure with clinic's appointment duration
      const slots = this.parseGHLResponse(response.data, appointmentDuration);
      
      this.logger.log(`Parsed ${slots.length} slots from GHL`);
      return slots;
    } catch (error) {
      this.logger.error(`Failed to fetch slots from GHL: ${error.message}`);
      this.logger.warn('GHL API failed, returning empty array');
      // Return empty array on error (don't return mock data)
      return [];
    }
  }

  /**
   * Parse GHL response format into standard slot format
   * GHL returns: { '2026-03-25': { slots: ['2026-03-25T08:00:00Z', ...] }, ... }
   */
  private parseGHLResponse(data: any, appointmentDuration: number): GHLSlot[] {
    const slots: GHLSlot[] = [];

    // Iterate over date keys (ignore traceId)
    Object.keys(data).forEach((dateKey) => {
      if (dateKey === 'traceId') return;

      const dayData = data[dateKey];
      if (!dayData || !dayData.slots || !Array.isArray(dayData.slots)) {
        return;
      }

      // Convert each slot string to GHLSlot object
      dayData.slots.forEach((slotTime: string) => {
        const startTime = new Date(slotTime);
        const endTime = new Date(startTime);
        endTime.setMinutes(startTime.getMinutes() + appointmentDuration);

        slots.push({
          id: `ghl_slot_${startTime.getTime()}`,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          available: true,
        });
      });
    });
    return slots;
  }

  /**
   * Create appointment in GHL Calendar
   */
  async createAppointment(
    calendarId: string,
    contactId: string,
    slotId: string,
  ): Promise<{ appointmentId: string }> {
    this.logger.log(
      `Creating appointment for contact ${contactId} in calendar ${calendarId}`,
    );

    try {
      const url = `https://services.leadconnectorhq.com/calendars/${calendarId}/appointments`;

      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            contactId,
            slotId,
          },
          {
            headers: {
              Authorization: `Bearer ${this.ghlApiKey}`,
              'Content-Type': 'application/json',
              Version: '2021-07-28',
            },
            timeout: 10000,
          },
        ),
      );

      this.logger.log(`Created appointment with ID: ${response.data.id}`);
      return { appointmentId: response.data.id };
    } catch (error) {
      this.logger.error(`Failed to create appointment: ${error.message}`);
      
      // Throw error instead of returning mock data
      throw error;
    }
  }
}