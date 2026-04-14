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
   * Filter slots by clinic business hours.
   * Business hours are stored as UK local time (HH:MM), so we compare using
   * Europe/London timezone rather than UTC to handle BST/GMT correctly.
   */
  private filterByBusinessHours(
    slots: GHLSlot[],
    clinic: ClinicDocument,
  ): GHLSlot[] {
    return slots.filter((slot) => {
      const slotStart = new Date(slot.startTime);

      // Use Europe/London timezone so day name and time are correct during BST
      const dayName = slotStart
        .toLocaleDateString("en-US", { weekday: "long", timeZone: "Europe/London" })
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

      // Extract slot time in UK local timezone so it matches stored business hours
      const slotTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(slotStart);

      return (
        slotTime >= businessHour.openTime && slotTime < businessHour.closeTime
      );
    });
  }

  /**
   * Format slots for return.
   * Extracts date and time in Europe/London timezone so the values displayed
   * to leads match UK local time (handling BST/GMT automatically).
   */
  private formatSlots(slots: GHLSlot[]): SlotDto[] {
    return slots.map((slot) => {
      const dateTime = new Date(slot.startTime);
      const endDateTime = new Date(slot.endTime);

      // Extract all date/time parts in UK local time in a single format call
      const startParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(dateTime);
      const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
        parts.find((p) => p.type === type)?.value ?? "";

      const date = `${getPart(startParts, "year")}-${getPart(startParts, "month")}-${getPart(startParts, "day")}`;
      const startTime = `${getPart(startParts, "hour")}:${getPart(startParts, "minute")}`;

      const endParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(endDateTime);
      const endTime = `${getPart(endParts, "hour")}:${getPart(endParts, "minute")}`;

      return { date, startTime, endTime, dateTime };
    });
  }
}
