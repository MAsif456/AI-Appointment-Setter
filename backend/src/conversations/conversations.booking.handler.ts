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
 * Converts a UTC Date to an ISO 8601 string with the correct UK timezone offset.
 * e.g. "2026-04-10T10:00:00+01:00" during BST or "2026-10-30T10:00:00+00:00" during GMT.
 * This ensures GHL displays the appointment at the exact time confirmed to the lead.
 */
function toUKTimezoneISO(utcDate: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const localStr = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
  // Offset = difference between UK local time (treated as UTC) and actual UTC
  const offsetMs = new Date(localStr + "Z").getTime() - utcDate.getTime();
  const totalMinutes = Math.round(offsetMs / 60000);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absMin = Math.abs(totalMinutes);
  const hh = Math.floor(absMin / 60).toString().padStart(2, "0");
  const mm = (absMin % 60).toString().padStart(2, "0");
  return `${localStr}${sign}${hh}:${mm}`;
}

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
  // Send with explicit UK timezone offset so GHL shows the exact confirmed time
  // regardless of GHL's calendar timezone setting.
  const startTime = toUKTimezoneISO(utcDate);

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
    logger.error(`Auto-booking failed: ${error.message}`);
    return { success: false, error: "Booking failed unexpectedly" };
  }
}
