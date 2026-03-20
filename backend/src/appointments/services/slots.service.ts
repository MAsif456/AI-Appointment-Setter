import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clinic, ClinicDocument } from '../../database/schemas/clinic.schema';
import { Conversation, ConversationDocument } from '../../database/schemas/conversation.schema';
import { GHLCalendarService, GHLSlot } from './ghl-calendar.service';
import { FetchSlotsDto } from '../dto/fetch-slots.dto';
import { OfferSlotsResponseDto, SlotDto } from '../dto/offer-slots-response.dto';

@Injectable()
export class SlotsService {
  private readonly logger = new Logger(SlotsService.name);

  constructor(
    @InjectModel(Clinic.name) private clinicModel: Model<ClinicDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private ghlCalendarService: GHLCalendarService,
  ) {}

  /**
   * Fetch and offer available slots to a lead
   */
  async fetchAndOfferSlots(dto: FetchSlotsDto): Promise<OfferSlotsResponseDto> {
    // Get clinic configuration
    const clinic = await this.clinicModel.findById(dto.clinicId);
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    if (!clinic.ghlCalendarId || !clinic.ghlApiKey) {
        throw new Error('Missing GHL calendar configuration for clinic'); 
    }

    // Determine date range
    const { startDate, endDate } = this.getDateRange(dto.preferredDate);

    // Fetch slots from GHL
    const ghlSlots = await this.ghlCalendarService.fetchAvailableSlots(
      clinic.ghlCalendarId,
      startDate,
      endDate,
      clinic.ghlApiKey,
    );

    // Filter slots based on business hours and duration
    const filteredSlots = this.filterSlots(ghlSlots, clinic, dto.serviceType);
    // Format slots for conversation
    const formattedSlots = this.formatSlots(filteredSlots, dto.isUrgent);

    // Store offered slots in conversation
    await this.storeOfferedSlots(dto.leadId, dto.clinicId, formattedSlots);

    // Generate conversational response
    const message = this.generateResponse(formattedSlots, dto.isUrgent, dto.preferredDate);

    return {
      message, slots: formattedSlots, isEmpty: formattedSlots.length === 0,
    };
  }

  /**
   * Get date range for slot search
   */
  private getDateRange(preferredDate?: string): { startDate: Date; endDate: Date } {
    const startDate = preferredDate ? new Date(preferredDate) : new Date();
    
    // If no preferred date, search next 14 days
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);

    return { startDate, endDate };
  }

  /**
   * Filter slots based on business hours and appointment duration
   */
  private filterSlots(
    ghlSlots: GHLSlot[],
    clinic: ClinicDocument,
    serviceType?: string,
  ): GHLSlot[] {
    const appointmentDuration = this.getAppointmentDuration(clinic, serviceType);

    return ghlSlots.filter((slot) => {
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      const slotDuration = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60); // minutes

      // Check if slot has sufficient duration
      if (slotDuration < appointmentDuration) {
        return false;
      }

      // Check if slot is within business hours
      const dayName = slotStart
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toLowerCase();
      const businessHour = clinic.businessHours.find((bh) => bh.day === dayName);

      if (!businessHour || !businessHour.isOpen) {
        return false;
      }

      if (!businessHour.openTime || !businessHour.closeTime) {
        return false;
      }

      const slotTime = slotStart.toTimeString().substring(0, 5); // "14:30"
    return slotTime >= businessHour.openTime && slotTime < businessHour.closeTime;
  });
}

  /**
   * Get appointment duration for service type
   */
  private getAppointmentDuration(clinic: ClinicDocument, serviceType?: string): number {
    if (serviceType) {
      const service = clinic.services.find((s) => s.name === serviceType);
      if (service) {
        return service.durationMinutes;
      }
    }
    return clinic.defaultAppointmentDuration;
  }

  /**
   * Format slots for conversational display
   */
  private formatSlots(slots: GHLSlot[], isUrgent?: boolean): SlotDto[] {
    const formatted = slots.map((slot) => {
      const dateTime = new Date(slot.startTime);
      const displayText = this.formatSlotDisplay(dateTime);

      return {
        dateTime,
        displayText,
        isEarliest: false,
      };
    });

    // Sort by date (earliest first)
    formatted.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    // Mark earliest slot if urgent
    if (isUrgent && formatted.length > 0) {
      formatted[0].isEarliest = true;
    }

    // Limit to first 5 slots for conversation
    return formatted.slice(0, 5);
  }

  /**
   * Format a single slot for display: "Tuesday at 2pm"
   */
  private formatSlotDisplay(dateTime: Date): string {
    const day = dateTime.toLocaleDateString('en-US', { weekday: 'long' });
    const time = dateTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${day} at ${time}`;
  }

  /**
   * Store offered slots in conversation context
   */
  private async storeOfferedSlots(
    leadId: string,
    clinicId: string,
    slots: SlotDto[],
  ): Promise<void> {
    const conversation = await this.conversationModel.findOne({
      leadId: new Types.ObjectId(leadId),
      clinicId: new Types.ObjectId(clinicId),
    }).sort({ createdAt: -1 });

    if (conversation) {
      conversation.offeredSlots = slots.map((slot) => ({
        dateTime: slot.dateTime,
        displayText: slot.displayText,
      }));
      conversation.lastMessageAt = new Date();
      await conversation.save();

      this.logger.log(`Stored ${slots.length} offered slots in conversation ${conversation._id}`);
    }
  }

  /**
   * Generate conversational response
   */
  private generateResponse(
    slots: SlotDto[],
    isUrgent?: boolean,
    preferredDate?: string,
  ): string {
    if (slots.length === 0) {
      if (preferredDate) {
        return "We're fully booked on this date. Would you like me to check a different date?";
      }
      return "I don't have any available slots at the moment. Would you like me to notify you when a slot opens up?";
    }

    if (slots.length === 1) {
      const slot = slots[0];
      if (isUrgent) {
        return `I can get you in at our earliest available slot: ${slot.displayText}. Does this work for you?`;
      }
      return `I have ${slot.displayText} available. Would this work for you?`;
    }

    // Multiple slots
    const slotList = slots.map((s) => s.displayText).join(', or ');
    
    if (isUrgent && slots[0].isEarliest) {
      return `For your urgent case, I have ${slots[0].displayText} as our earliest slot, or ${slots.slice(1).map(s => s.displayText).join(', ')}. Which works best for you?`;
    }

    return `I have ${slotList}. Which works best for you?`;
  }
}