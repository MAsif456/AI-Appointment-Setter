import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from '../../database/schemas/clinic.schema';
import { GHLCalendarService, GHLSlot } from './ghl-calendar.service';

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

      // Check if API key exists
      if (!clinic.ghlApiKey) {
        this.logger.error(`Clinic ${clinicId} has no GHL API key configured`);
        return [];
      }

      // Fetch slots from GHL
      const ghlSlots = await this.ghlCalendarService.fetchAvailableSlots(
        clinic.ghlCalendarId,
        startDate,
        endDate,
        clinic.ghlApiKey,
      );

      if (!ghlSlots || ghlSlots.length === 0) {
        this.logger.log('No slots available from GHL');
        return [];
      }

      // Filter by business hours
      const businessHoursFiltered = this.filterByBusinessHours(ghlSlots, clinic);

      // Filter by appointment duration
      const durationFiltered = this.filterByDuration(
        businessHoursFiltered,
        clinic.defaultAppointmentDuration,
      );

      // Format for return
      return this.formatSlots(durationFiltered);
    } catch (error) {
      this.logger.error(`Error fetching slots: ${error.message}`);
      return []; // Return empty array on error
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
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toLowerCase();

      // Find business hours for this day
      const businessHour = clinic.businessHours.find((bh) => bh.day === dayName);

      // Not open on this day
      if (!businessHour || !businessHour.isOpen) {
        return false;
      }

      // Check if openTime and closeTime exist
      if (!businessHour.openTime || !businessHour.closeTime) {
        this.logger.warn(`Business hours missing for ${dayName}`);
        return false;
      }

      // Check time is within business hours
      const slotTime = slotStart.toTimeString().substring(0, 5); // "14:30"
      return slotTime >= businessHour.openTime && slotTime < businessHour.closeTime;
    });
  }

  /**
   * Filter slots by minimum appointment duration
   */
  private filterByDuration(slots: GHLSlot[], minDuration: number): GHLSlot[] {
    return slots.filter((slot) => {
      const start = new Date(slot.startTime);
      const end = new Date(slot.endTime);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60); // minutes

      return duration >= minDuration;
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
        date: dateTime.toISOString().split('T')[0], // "2024-03-25"
        startTime: dateTime.toTimeString().substring(0, 5), // "14:00"
        endTime: endTime.toTimeString().substring(0, 5), // "14:30"
        dateTime,
      };
    });
  }
}