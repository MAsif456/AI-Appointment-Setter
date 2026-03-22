import { Injectable, Logger } from '@nestjs/common';
import { Slot } from './interfaces/slot.interface';
import { SlotsService } from '../appointments/services/slots.service';

// Fallback mock data used when GHL API is unavailable
const FALLBACK_SLOTS: Slot[] = [
  { date: '2026-03-17', startTime: '14:00', endTime: '14:30' },
  { date: '2026-03-18', startTime: '10:00', endTime: '10:30' },
  { date: '2026-03-19', startTime: '15:00', endTime: '15:30' },
];

/**
 * Provides available appointment slots by delegating to the
 * GHL calendar integration (SlotsService from US-12).
 * Falls back to mock data if GHL is unavailable.
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
  async getAvailableSlots(clinicId: string): Promise<Slot[]> {
    try {
      // Query a 7-day window starting from today
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const ghlSlots = await this.slotsService.fetchAvailableSlots(
        clinicId, startDate, endDate,
      );

      // Return fallback if GHL returned nothing
      if (!ghlSlots || ghlSlots.length === 0) {
        this.logger.warn('No slots from GHL, using fallback mock data');
        return FALLBACK_SLOTS;
      }

      // Map SlotsService output to our Slot interface
      return ghlSlots.map((s) => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch GHL slots: ${error.message}`);
      return FALLBACK_SLOTS;
    }
  }
}
