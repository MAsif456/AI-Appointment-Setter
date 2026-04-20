import { Injectable, Logger } from "@nestjs/common";
import { Slot } from "./interfaces/slot.interface";
import { SlotsService } from "../appointments/services/slots.service";

/**
 * Provides available appointment slots by delegating to the
 * GHL calendar integration (SlotsService from US-12).
 * Returns an empty array when GHL is unavailable so the AI
 * can handle the "no availability" case conversationally.
 */
@Injectable()
export class SlotProvider {
  private readonly logger = new Logger(SlotProvider.name);

  constructor(private readonly slotsService: SlotsService) {}

  /**
   * Retrieves available appointment slots for a given clinic.
   * Fetches real slots from GHL via SlotsService and maps them
   * to the Slot interface used by the formatter and prompt builder.
   * @param clinicId - The ID of the clinic to fetch available slots for.
   * @returns A promise that resolves to an array of available appointment slots.
   */
  /** Maximum booking window: 4 months from today (GHL limitation) */
  static readonly MAX_ADVANCE_MONTHS = 4;

  async getAvailableSlots(
    clinicId: string,
    requestedStart?: Date,
    requestedEnd?: Date,
  ): Promise<Slot[]> {
    try {
      // Use the requested date range, or default to a 31-day window from today.
      // GHL only provides availability up to ~4 months in advance, so we cap
      // the end date to avoid fabricating availability beyond that range.
      const startDate = requestedStart ?? new Date();
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + SlotProvider.MAX_ADVANCE_MONTHS);
      maxDate.setDate(maxDate.getDate() + 1); // include the last day
      const defaultEnd = new Date(
        startDate.getTime() + 31 * 24 * 60 * 60 * 1000,
      );
      let endDate = requestedEnd ?? defaultEnd;
      // Clamp end date to 4-month GHL limit
      if (endDate > maxDate) endDate = maxDate;
      // If the entire requested range is beyond the limit, return empty
      if (startDate > maxDate) {
        this.logger.warn(
          `Requested start date ${startDate.toISOString()} is beyond the ${SlotProvider.MAX_ADVANCE_MONTHS}-month GHL booking limit`,
        );
        return [];
      }

      const ghlSlots = await this.slotsService.fetchAvailableSlots(
        clinicId,
        startDate,
        endDate,
      );

      if (!ghlSlots || ghlSlots.length === 0) {
        this.logger.warn("No slots returned from GHL");
        return [];
      }

      // Map SlotsService output to our Slot interface. `dateTime` carries the
      // authoritative UTC instant so later stages don't round-trip a London-
      // local display string back into UTC (which is off by 1h during BST).
      return ghlSlots.map((s) => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        dateTime: s.dateTime.toISOString(),
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch GHL slots: ${error.message}`);
      return [];
    }
  }
}
