import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Clinic, ClinicDocument } from "../../database/schemas/clinic.schema";
import { GHLCalendarService, GHLSlot } from "./ghl-calendar.service";

/** Typed error thrown when the GHL Calendar API is unreachable. */
export class CalendarUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarUnavailableError";
  }
}

export interface SlotDto {
  date: string; // "2024-03-25"
  startTime: string; // "14:00"
  endTime: string; // "14:30"
  dateTime: Date;
}

@Injectable()
export class SlotsService {
  private readonly logger = new Logger(SlotsService.name);

  constructor(
    @InjectModel(Clinic.name) private clinicModel: Model<ClinicDocument>,
    private ghlCalendarService: GHLCalendarService,
  ) {}

  /**
   * Fetch and filter available slots for a clinic
   * Fetch Available Slots from GHL Calendar
   */
  async fetchAvailableSlots(
    clinicId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SlotDto[]> {
    try {
      // Get clinic configuration
      const clinic = await this.clinicModel.findById(clinicId);
      if (!clinic) {
        this.logger.error(`Clinic ${clinicId} not found`);
        return [];
      }

      this.logger.log(
        `Fetching slots with appointment duration: ${clinic.defaultAppointmentDuration} minutes`,
      );

      // Fetch slots from GHL
      const ghlSlots = await this.ghlCalendarService.fetchAvailableSlots(
        clinic.ghlCalendarId,
        startDate,
        endDate,
        clinic.defaultAppointmentDuration,
      );

      if (!ghlSlots || ghlSlots.length === 0) {
        this.logger.log("No slots available from GHL");
        return [];
      }
      this.logger.log(
        `Received ${ghlSlots.length} slots from GHL before filtering`,
      );

      // Filter by business hours
      const businessHoursFiltered = this.filterByBusinessHours(
        ghlSlots,
        clinic,
      );
      this.logger.log(
        `${businessHoursFiltered.length} slots after business hours filter`,
      );

      // Format for return
      const formattedSlots = this.formatSlots(businessHoursFiltered);
      this.logger.log(`Returning ${formattedSlots.length} formatted slots`);

      return formattedSlots;
    } catch (error) {
      this.logger.error(`Error fetching slots: ${error.message}`);
      throw new CalendarUnavailableError(
        `GHL Calendar unavailable: ${error.message}`,
      );
    }
  }

  /**
   * Filter slots by clinic business hours
   */
  private filterByBusinessHours(
    slots: GHLSlot[],
    clinic: ClinicDocument,
  ): GHLSlot[] {
    return slots.filter((slot) => {
      const slotStart = new Date(slot.startTime);

      const dayName = slotStart
        .toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
        .toLowerCase();

      // Find business hours for this day
      const businessHour = clinic.businessHours.find(
        (bh) => bh.day === dayName,
      );

      // Not open on this day
      if (!businessHour || !businessHour.isOpen) {
        return false;
      }

      // Check if openTime and closeTime exist
      if (!businessHour.openTime || !businessHour.closeTime) {
        this.logger.warn(`Business hours missing for ${dayName}`);
        return false;
      }

      // Extract time in UTC (fixes timezone bug)
      const hours = slotStart.getUTCHours();
      const minutes = slotStart.getUTCMinutes();
      const slotTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

      // Compare withbusiness hours
      return (
        slotTime >= businessHour.openTime && slotTime < businessHour.closeTime
      );
    });
  }

  /**
   * Format slots for return
   */
  private formatSlots(slots: GHLSlot[]): SlotDto[] {
    return slots.map((slot) => {
      const dateTime = new Date(slot.startTime);
      const endTime = new Date(slot.endTime);

      return {
        date: dateTime.toISOString().split("T")[0], // "2024-03-25"
        startTime: dateTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }), // "14:00"
        endTime: endTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }), // "14:30"
        dateTime,
      };
    });
  }
}
