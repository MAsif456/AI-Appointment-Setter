import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

export interface GHLSlot {
  id: string;
  startTime: string; // ISO string
  endTime: string; // ISO string (calculated from appointment duration)
  available: boolean;
}

@Injectable()
export class GHLCalendarService {
  private readonly logger = new Logger(GHLCalendarService.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Fetch available slots from GHL Calendar API.
   *
   * @param {string} apiKey - The per-clinic GHL private integration token.
   */
  async fetchAvailableSlots(
    apiKey: string,
    calendarId: string,
    startDate: Date,
    endDate: Date,
    appointmentDuration: number,
  ): Promise<GHLSlot[]> {
    this.logger.log(
      `Fetching slots for calendar ${calendarId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    try {
      const startTimestamp = startDate.getTime();
      const endTimestamp = endDate.getTime();

      const url = `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          },
          params: {
            startDate: startTimestamp,
            endDate: endTimestamp,
          },
          timeout: 10000,
        }),
      );

      this.logger.log(`GHL API Response received`);

      const slots = this.parseGHLResponse(response.data, appointmentDuration);
      this.logger.log(`Parsed ${slots.length} slots from GHL`);
      return slots;
    } catch (error) {
      this.logger.error(`Failed to fetch slots from GHL: ${error.message}`);
      this.logger.warn("GHL API failed, returning empty array");
      return [];
    }
  }

  /**
   * Parse GHL response format into standard slot format.
   * GHL returns: { '2026-03-25': { slots: ['2026-03-25T08:00:00Z', ...] }, ... }
   */
  private parseGHLResponse(data: any, appointmentDuration: number): GHLSlot[] {
    const slots: GHLSlot[] = [];

    Object.keys(data).forEach((dateKey) => {
      if (dateKey === "traceId") return;

      const dayData = data[dateKey];
      if (!dayData || !dayData.slots || !Array.isArray(dayData.slots)) {
        return;
      }

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
   * Create appointment in GHL Calendar.
   * startTime must be a UTC ISO 8601 string (e.g. "2026-04-20T09:00:00.000Z").
   * GHL reads the calendar's timezone (Europe/London) and displays the time in BST/GMT.
   *
   * @param {string} apiKey - The per-clinic GHL private integration token.
   */
  async createAppointment(
    apiKey: string,
    calendarId: string,
    locationId: string,
    contactId: string,
    startTime: string,
    endTime: string,
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating appointment for contact ${contactId} in calendar ${calendarId} at ${startTime}`,
    );

    try {
      const url = `https://services.leadconnectorhq.com/calendars/${calendarId}/appointments`;

      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            calendarId,
            locationId,
            contactId,
            startTime,
            endTime,
            title: 'Appointment',
            appointmentStatus: 'confirmed',
            toNotify: false,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              Version: "2021-07-28",
            },
            timeout: 10000,
          },
        ),
      );

      this.logger.log(`Created appointment with ID: ${response.data.id}`);
      return { id: response.data.id };
    } catch (error) {
      this.logger.error(`Failed to create appointment: ${error.message}`);
      throw error;
    }
  }
}