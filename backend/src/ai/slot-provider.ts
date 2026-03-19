import { Injectable } from '@nestjs/common';
import { Slot } from './interfaces/slot.interface';

//NOTE: This is a placeholder implementation. The getAvailableSlots method currently returns mock data for development and testing purposes. Once US-12 (Fetch Available Slots) is complete, this method will be updated to integrate with the GHL calendar API to fetch real available slots based on the clinicId parameter.
// Mock data representing available appointment slots
const MOCK_SLOTS: Slot[] = [
  { date: '2026-03-17', startTime: '14:00', endTime: '14:30' },
  { date: '2026-03-18', startTime: '10:00', endTime: '10:30' },
  { date: '2026-03-19', startTime: '15:00', endTime: '15:30' },
];

/**
 * Provides available appointment slots.
 * Currently returns mock data; will delegate to GHL calendar
 * service once US-12 (Fetch Available Slots) is complete.
 */
@Injectable()
export class SlotProvider {
 
/**
 * Retrieves available appointment slots for a given clinic.
 * Currently returns mock data for development and testing purposes;
 * will be replaced by GHL calendar API integration once US-12 is complete.
 * @param _clinicId - The ID of the clinic to fetch available slots for.
 * @returns A promise that resolves to an array of available appointment slots.
 */
  async getAvailableSlots(_clinicId: string): Promise<Slot[]> {
    // NOTE: Integrate with GHL calendar API to fetch real slots based on clinicId
    // For now, return mock data for development and testing
    return MOCK_SLOTS;
  }
}
