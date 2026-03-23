import { Injectable, Logger } from '@nestjs/common';
import { Slot } from './interfaces/slot.interface';
import { SlotsService } from '../appointments/services/slots.service';

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
  async getAvailableSlots(
    clinicId: string,
    requestedStart?: Date,
    requestedEnd?: Date,
  ): Promise<Slot[]> {
    try {
      // Use the requested date range, or default to a 7-day window from today
      const startDate = requestedStart ?? new Date();
      const endDate = requestedEnd ?? new Date(startDate.getTime() + 31 * 24 * 60 * 60 * 1000);

      const ghlSlots = await this.slotsService.fetchAvailableSlots(
        clinicId, startDate, endDate,
      );

      if (!ghlSlots || ghlSlots.length === 0) {
        this.logger.warn('No slots returned from GHL');
        return [];
      }

      // Map SlotsService output to our Slot interface
      return ghlSlots.map((s) => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch GHL slots: ${error.message}`);
      return [];
    }
  }
}
