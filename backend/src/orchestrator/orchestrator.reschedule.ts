/**
 * Standalone handler for the rescheduling slot flow.
 *
 * Called from handleInboundMessageFlow when the conversation phase is
 * 'rescheduling' and the intent is UNKNOWN (i.e. the lead is either
 * expressing a date preference or selecting from previously offered slots).
 *
 * Responsibilities:
 *   1. If offered slots exist in context and the lead selects one → executeReschedule
 *   2. Otherwise fetch slots for the requested date and offer them
 *   3. Return a response string and a flag indicating whether the reschedule completed
 */
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';
import { Slot } from '../ai/interfaces/slot.interface';
import { SlotProvider } from '../ai/slot-provider';
import { selectSlots, buildSlotPromptSection, formatSlotDisplay } from '../ai/slot-formatter';
import { detectSlotSelection } from '../ai/slot-selector';
import { OfferedSlotRef } from '../ai/slot-selector.types';
import { GroqService } from '../ai/groq.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { ConversationsService } from '../ghl/conversations.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { ConversationDocument } from '../database/schemas/conversation.schema';
import { formatDateBritish } from '../appointments/confirmation-message.builder';
import { buildSingleTurnPrompt } from './orchestrator.prompts';
import { OrchestratorContext } from './orchestrator.types';

export const FULLY_BOOKED_RESPONSE =
  "We're fully booked on that date. Would you like to try a different day?";

export interface RescheduleDeps {
  slotProvider: SlotProvider;
  groqService: GroqService;
  ghlApiService: GhlApiService;
  conversationsService: ConversationsService;
  appointmentsService: AppointmentsService;
  logger: Logger;
}

export interface RescheduleFlowResult {
  response: string;
  completedReschedule: boolean;
}

const OFFERED_SLOTS_KEY = 'reschedulingOfferedSlots';

/**
 * Handles a message received while the conversation is in the 'rescheduling' phase.
 * Determines whether to execute a reschedule (slot selected) or offer new slots.
 */
export async function handleReschedulingSlotFlow(
  messageContent: string,
  conversation: ConversationDocument,
  contactId: string,
  context: OrchestratorContext,
  clinicConfig: ClinicConfig,
  deps: RescheduleDeps,
): Promise<RescheduleFlowResult> {
  const { conversationsService, logger } = deps;
  const conversationId = conversation._id as Types.ObjectId;

  // Deserialise any previously offered slots stored in the context map
  const raw = conversation.context?.get(OFFERED_SLOTS_KEY);
  const offeredSlots: OfferedSlotRef[] = raw ? (JSON.parse(raw) as OfferedSlotRef[]) : [];

  // If slots were offered in a prior turn, check whether the lead selected one
  if (offeredSlots.length > 0) {
    const selection = detectSlotSelection(messageContent, offeredSlots);
    if (selection.intent === 'SLOT_SELECTED' && selection.selectedSlot) {
      return executeReschedule(selection.selectedSlot, conversation, contactId, clinicConfig, deps);
    }
  }

  // Fetch available slots and offer:
  //   - all remaining slots on the same day as the current booking
  //   - plus 3 slots from one different day (same week where possible, otherwise next available day)
  // Fallback to the default selector when the current appointment date is unavailable.
  const currentApptDateStr =
    (context.currentAppointment?.startTime
      ? new Date(context.currentAppointment.startTime).toISOString().split('T')[0]
      : null) ?? parseBritishDate(context.currentAppointment?.appointmentDate);
  const currentApptTimeStr =
    parseTimeLabelTo24h(context.currentAppointment?.appointmentTime) ??
    extractTimeFromIso(context.currentAppointment?.startTime);
  const allSlots = await deps.slotProvider.getAvailableSlots(clinicConfig.clinicId);
  const slots = selectRescheduleSlots(allSlots, currentApptDateStr, currentApptTimeStr);

  if (slots.length === 0) {
    logger.warn(`No slots available for reschedule — contactId: ${contactId}, clinicId: ${clinicConfig.clinicId}`);
    return { response: FULLY_BOOKED_RESPONSE, completedReschedule: false };
  }

  // Persist offered slots so the next reply can match against them
  const offered: OfferedSlotRef[] = slots.map((s) => ({
    dateTime: new Date(`${s.date}T${s.startTime}:00`).toISOString(),
    displayText: formatSlotDisplay(s),
  }));
  await conversationsService.setContext(conversationId, OFFERED_SLOTS_KEY, JSON.stringify(offered));

  const slotSection = buildSlotPromptSection(slots, 'routine');
  const situationContext = `The patient wants to reschedule and you are offering available slots. ${slotSection}`;
  const response = await deps.groqService.generateResponse(
    buildSingleTurnPrompt(situationContext, context, clinicConfig),
  );

  return { response: response ?? FULLY_BOOKED_RESPONSE, completedReschedule: false };
}

/**
 * Cancels the old appointment and books the selected slot as the replacement.
 * Updates conversation context, adds 'rescheduled' tag, and updates the custom field.
 */
async function executeReschedule(
  selectedSlot: OfferedSlotRef,
  conversation: ConversationDocument,
  contactId: string,
  clinicConfig: ClinicConfig,
  deps: RescheduleDeps,
): Promise<RescheduleFlowResult> {
  const { ghlApiService, appointmentsService, conversationsService, logger } = deps;
  const conversationId = conversation._id as Types.ObjectId;
  const leadId = (conversation.leadId as Types.ObjectId).toString();
  const ghlAppointmentId = conversation.context?.get('ghlAppointmentId') ?? '';

  // Step 1: Cancel the old appointment (returns null on failure)
  const cancelled = await ghlApiService.cancelAppointment(ghlAppointmentId);
  if (cancelled === null) {
    logger.error(`Failed to cancel appointment ${ghlAppointmentId} for contact ${contactId}`);
    return {
      response: 'Sorry, there was an issue rescheduling your appointment. Please try again.',
      completedReschedule: false,
    };
  }

  // Step 2: Book the new appointment
  const startTime = new Date(selectedSlot.dateTime as string).toISOString();
  const bookingResult = await appointmentsService.bookAppointment({
    clinicId: clinicConfig.clinicId,
    contactId,
    conversationId: conversationId.toString(),
    leadId,
    startTime,
  });

  if (!bookingResult.success) {
    logger.error(`New appointment booking failed for contact ${contactId} after cancelling ${ghlAppointmentId}`);
    return {
      response: 'Sorry, there was an issue booking your new appointment. Please contact the clinic directly.',
      completedReschedule: false,
    };
  }

  // Step 3: Non-critical GHL contact updates (tag + custom field)
  const tagResult = await ghlApiService.addContactTag(contactId, 'rescheduled');
  if (tagResult === null) {
    logger.warn(`Could not add "rescheduled" tag for contact ${contactId}`);
  }
  const { date } = formatDateBritish(startTime);
  try {
    await ghlApiService.updateContactCustomField(contactId, 'appointment_date', date);
  } catch (e) {
    logger.warn(`Could not update appointment_date custom field for contact ${contactId}: ${(e as Error).message}`);
  }

  // Clear the offered-slots buffer now that the reschedule is done
  await conversationsService.setContext(conversationId, OFFERED_SLOTS_KEY, '');

  // bookAppointment already sets phase to 'booked' and stores new appointment context
  const confirmationMessage =
    bookingResult.confirmationMessage ??
    `Your appointment has been rescheduled to ${selectedSlot.displayText}. We look forward to seeing you!`;

  return { response: confirmationMessage, completedReschedule: true };
}

/**
 * Parses a British date string (e.g. "Thursday 9th April") into YYYY-MM-DD using the current year.
 * Used as a fallback when appointmentStartTime is not stored in the conversation context.
 * Returns null if the string cannot be parsed.
 */
function parseBritishDate(britishDate?: string): string | null {
  if (!britishDate) return null;
  const MONTHS: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04',
    May: '05', June: '06', July: '07', August: '08',
    September: '09', October: '10', November: '11', December: '12',
  };
  const match = britishDate.match(/(\d+)\w*\s+(\w+)/);
  if (!match) return null;
  const [, dayStr, monthName] = match;
  const month = MONTHS[monthName];
  if (!month) return null;
  const day = dayStr.padStart(2, '0');
  const year = new Date().getFullYear();
  return `${year}-${month}-${day}`;
}

function selectRescheduleSlots(
  allSlots: Slot[],
  currentApptDateStr: string | null,
  currentApptTimeStr: string | null,
): Slot[] {
  if (allSlots.length === 0) return [];

  const sorted = [...allSlots].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  if (!currentApptDateStr) return selectSlots(sorted, 'routine');

  const currentApptMinutes = currentApptTimeStr ? hhmmToMinutes(currentApptTimeStr) : null;
  const sameDaySlots = sorted.filter((slot) => {
    if (slot.date !== currentApptDateStr) return false;
    if (currentApptMinutes === null) return true;
    return hhmmToMinutes(slot.startTime) > currentApptMinutes;
  });

  const alternateDays = Array.from(
    new Set(
      sorted
        .filter((slot) => slot.date !== currentApptDateStr)
        .map((slot) => slot.date),
    ),
  );

  // Prefer a day in the same ISO week as the original booking; otherwise use the next available day.
  const currentWeekStart = getWeekStart(currentApptDateStr);
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
  const alternateDate =
    alternateDays.find((dateStr) => {
      const date = new Date(`${dateStr}T00:00:00`);
      return date >= currentWeekStart && date <= currentWeekEnd;
    }) ?? alternateDays[0];

  const alternateDaySlots = alternateDate
    ? sorted.filter((slot) => slot.date === alternateDate).slice(0, 3)
    : [];

  return [...sameDaySlots, ...alternateDaySlots];
}

function getWeekStart(dateStr: string): Date {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

function hhmmToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function parseTimeLabelTo24h(timeLabel?: string): string | null {
  if (!timeLabel) return null;
  const match = timeLabel.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!match) return null;
  const [, hourStr, minuteStr, period] = match;
  let hour = Number(hourStr);
  if (Number.isNaN(hour) || hour < 1 || hour > 12) return null;
  const minute = Number(minuteStr ?? '0');
  if (Number.isNaN(minute) || minute < 0 || minute > 59) return null;
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractTimeFromIso(isoDateTime?: string): string | null {
  if (!isoDateTime) return null;
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
