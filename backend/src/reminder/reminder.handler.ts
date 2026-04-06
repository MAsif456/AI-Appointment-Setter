/**
 * Reminder message generation, intent detection, and send-window calculation handlers.
 * Extracted to keep reminder.service.ts under 200 lines.
 */
import { format } from 'date-fns';
import { AppointmentDocument } from '../database/schemas/appointment.schema';
import { ClinicDocument } from '../database/schemas/clinic.schema';

/**
 * Determine if a reminder should be sent for this appointment.
 * AC: Check timing window (15min tolerance) and prevent duplicate sends.
 * @param appointment - The appointment to check
 * @param reminderTimes - Array of hours-before-appointment intervals (e.g. [24, 1])
 * @returns Object indicating whether to send, the reminder type, and hours before
 */
export function shouldSendReminder(
  appointment: AppointmentDocument,
  reminderTimes: number[],
): { send: boolean; type?: string; hoursBeforeAppointment?: number } {
  const now = new Date();
  const appointmentTime = new Date(appointment.appointmentDate);
  // Use fractional hours so the 15-min window check works correctly
  const hoursUntilAppointment =
    (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  for (const interval of reminderTimes) {
    // Check if we're within the send window (15min tolerance for cron)
    const isWithinWindow =
      hoursUntilAppointment <= interval &&
      hoursUntilAppointment >= interval - 0.25;

    if (!isWithinWindow) {
      continue;
    }

    // AC: Don't send duplicate reminders
    const alreadySent = appointment.reminders?.some(
      (reminder) =>
        reminder.type === `${interval}_hour` && reminder.status === 'sent',
    );

    if (alreadySent) {
      continue;
    }

    return {
      send: true,
      type: `${interval}_hour`,
      hoursBeforeAppointment: interval,
    };
  }

  return { send: false };
}

/**
 * Generate reminder message based on hours until appointment.
 * AC: British English formatting, includes date/time/address/reschedule option.
 * @param appointment - The appointment to generate a message for
 * @param clinic - The clinic config for name and address
 * @param hoursBeforeAppointment - How many hours before the appointment
 */
export function generateReminderMessage(
  appointment: AppointmentDocument,
  clinic: ClinicDocument,
  hoursBeforeAppointment: number,
): string {
  const appointmentDate = new Date(appointment.appointmentDate);
  const clinicAddress = clinic.address || 'the clinic';

  // Format date in British English
  const dayName = format(appointmentDate, 'EEEE'); // "Tuesday"
  const dateFormatted = format(appointmentDate, 'do MMMM'); // "15th March"
  const timeFormatted = appointment.appointmentTime; // "14:00"

  if (hoursBeforeAppointment === 1) {
    // AC: 1-hour reminder format
    return `Just a reminder - your appointment is in 1 hour! ${clinic.name}, ${clinicAddress}.`;
  }

  if (hoursBeforeAppointment === 24) {
    // AC: 24-hour reminder format with full details
    return (
      `Reminder: Your appointment at ${clinic.name} is tomorrow ` +
      `(${dayName} ${dateFormatted}) at ${timeFormatted}. ` +
      `Address: ${clinicAddress}. ` +
      `Reply if you need to reschedule or cancel.`
    );
  }

  if (hoursBeforeAppointment === 48) {
    // 48-hour reminder format
    return (
      `Upcoming appointment: ${clinic.name} on ${dayName} ${dateFormatted} ` +
      `at ${timeFormatted}. Address: ${clinicAddress}. ` +
      `Reply if you need to reschedule or cancel.`
    );
  }

  // Custom interval reminder
  const daysUntil = Math.floor(hoursBeforeAppointment / 24);
  const timeReference =
    daysUntil > 0
      ? `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`
      : 'soon';

  return (
    `Reminder: Your appointment at ${clinic.name} is ${timeReference} ` +
    `on ${dayName} ${dateFormatted} at ${timeFormatted}. ` +
    `Address: ${clinicAddress}. Reply to reschedule or cancel.`
  );
}

/**
 * Check if a message is a response to a reminder.
 * Looks for reminder keywords in recent message history.
 * @param messageContent - The incoming message text
 * @param recentMessages - Recent message history to check
 */
export function isReminderResponse(
  messageContent: string,
  recentMessages: Array<{ sender: string; content: string }>,
): boolean {
  if (recentMessages.length === 0) return false;

  const lastMessage = recentMessages[recentMessages.length - 1];
  const isLastMessageReminder =
    lastMessage.sender === 'system' &&
    (lastMessage.content.includes('Reminder:') ||
      lastMessage.content.includes('reminder'));

  return isLastMessageReminder;
}

/**
 * Detect reschedule intent from message.
 * AC: Match various phrasings like "I need to reschedule", "can't make it", etc.
 * @param messageContent - The incoming message text
 */
export function detectRescheduleIntent(messageContent: string): boolean {
  const reschedulePatterns = [
    /\b(reschedule|re-schedule|rebook|re-book|change|move)\b/i,
    /\b(different|another)\s+(time|date|day)\b/i,
    /\bcan'?t\s+make\s+it\b/i,
    /\bneed\s+to\s+(change|move)\b/i,
  ];

  return reschedulePatterns.some((pattern) => pattern.test(messageContent));
}

/**
 * Detect cancel intent from message.
 * AC: Match various phrasings like "I need to cancel", "won't make it", etc.
 * @param messageContent - The incoming message text
 */
export function detectCancelIntent(messageContent: string): boolean {
  const cancelPatterns = [
    /\bcancel/i,
    /\bcan'?t\s+(come|attend)\b/i,
    /\bnot\s+coming\b/i,
    /\bwon'?t\s+make\s+it\b/i,
  ];

  return cancelPatterns.some((pattern) => pattern.test(messageContent));
}