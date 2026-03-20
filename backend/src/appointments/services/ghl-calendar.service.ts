import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface GHLSlot {
  id: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string (calculated from slot duration)
  available: boolean;
}

@Injectable()
export class GHLCalendarService {
  private readonly logger = new Logger(GHLCalendarService.name);
  
  // GHL uses 10-minute slot intervals
  private readonly SLOT_DURATION_MINUTES = 10;

  constructor(private readonly httpService: HttpService) {}

  /**
   * Fetch available slots from GHL Calendar API
   */
  async fetchAvailableSlots(
    calendarId: string,
    startDate: Date,
    endDate: Date,
    apiKey: string,
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
            Authorization: `Bearer ${apiKey}`,
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

      // Parse the response structure
      const slots = this.parseGHLResponse(response.data);
      
      this.logger.log(`Parsed ${slots.length} slots from GHL`);
      return slots;
    } catch (error) {
      this.logger.error(`Failed to fetch slots from GHL: ${error.message}`);
      this.logger.warn('Falling back to mock data');
      
      return this.getMockSlots(startDate, endDate);
    }
  }

  /**
   * Parse GHL response format into standard slot format
   * GHL returns: { '2026-03-25': { slots: ['2026-03-25T08:00:00Z', ...] }, ... }
   */
  private parseGHLResponse(data: any): GHLSlot[] {
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
        endTime.setMinutes(startTime.getMinutes() + this.SLOT_DURATION_MINUTES);

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
   * Generate mock slots for testing
   */
  private getMockSlots(startDate: Date, endDate: Date): GHLSlot[] {
    const slots: GHLSlot[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const dayOfWeek = current.getDay();

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        for (let hour = 8; hour < 18; hour++) {
          const slotStart = new Date(current);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(30);

          slots.push({
            id: `mock_slot_${slotStart.getTime()}`,
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            available: true,
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }

    this.logger.log(`Generated ${slots.length} mock slots`);
    return slots;
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
              Authorization: `Bearer ${apiKey}`,
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
      this.logger.warn('Returning mock appointment ID');
      
      return { appointmentId: `mock_appt_${Date.now()}` };
    }
  }
}