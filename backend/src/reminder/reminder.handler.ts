/**
 * Reminder message generation and intent detection handlers.
 * Extracted to keep reminder.service.ts under 200 lines.
 */
import { format } from 'date-fns';
import { AppointmentDocument } from '../database/schemas/appointment.schema';
import { ClinicDocument } from '../database/schemas/clinic.schema';

/**
 * Generate reminder message based on hours until appointment.
 * AC: British English formatting, includes date/time/address/reschedule option.
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