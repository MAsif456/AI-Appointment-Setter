/** Handles automatic appointment booking when a lead confirms a slot selection. */
import { Logger } from "@nestjs/common";
import { ConversationDocument } from "../database/schemas/conversation.schema";
import { ClinicDocument } from "../database/schemas/clinic.schema";
import { LeadDocument } from "../database/schemas/lead.schema";
import {
  AppointmentsService,
  BookingResult,
} from "../appointments/appointments.service";
import { SlotSelectionResult } from "../ai/slot-selector";


/**
 * Extracts the selected slot datetime and delegates to AppointmentsService.
 * @param conversation - The active conversation document.
 * @param clinic - The clinic document.
 * @param lead - The lead document.
 * @param selectionResult - The confirmed slot selection.
 * @param appointmentsService - The service used to book the appointment.
 * @param logger - Logger for audit trail.
 * @returns The booking result indicating success, failure, or slot-taken.
 */
export async function handleBooking(
  conversation: ConversationDocument,
  clinic: ClinicDocument,
  lead: LeadDocument,
  selectionResult: SlotSelectionResult,
  appointmentsService: AppointmentsService,
  logger: Logger,
): Promise<BookingResult> {
  const selectedSlot = selectionResult.selectedSlot!;
  const utcDate =
    selectedSlot.dateTime instanceof Date
      ? selectedSlot.dateTime
      : new Date(selectedSlot.dateTime);
  // GHL treats the time component as UTC regardless of any offset suffix,
  // so send pure UTC here. GHL's calendar (set to Europe/London) will display
  // it correctly in BST/GMT without any double-conversion.
  const startTime = utcDate.toISOString();

  const contactId =
    lead.ghlContactId ?? conversation.ghlContactId;
  if (!contactId) {
    logger.warn(`No GHL contact ID for lead ${lead._id} — cannot book in GHL`);
    return { success: false, error: 'No GHL contact ID available for this lead' };
  }

  const bookingDto = {
    clinicId: clinic._id.toString(),
    contactId,
    conversationId: conversation._id.toString(),
    leadId: lead._id.toString(),
    startTime,
  };

  try {
    const result = await appointmentsService.bookAppointment(bookingDto);
    if (result.success) {
      logger.log(
        `Auto-booked appointment ${result.appointmentId} for conversation ${conversation._id}`,
      );
    } else if (result.slotTaken) {
      logger.warn(
        `Slot was taken during auto-booking for conversation ${conversation._id}`,
      );
    }
    return result;
  } catch (error) {
    logger.error(`Auto-booking failed: ${(error as Error).message}`);
    return { success: false, error: "Booking failed unexpectedly" };
  }
}
