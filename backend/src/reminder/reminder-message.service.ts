import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { Appointment } from '../database/schemas/appointment.schema';
import { Clinic } from '../database/schemas/clinic.schema';

/**
 * Service responsible for generating reminder message text
 * Handles different reminder types (1h, 24h, 48h, custom)
 */
@Injectable()
export class ReminderMessageService {
  /**
   * Generate reminder message text based on time until appointment
   * Uses British English date formatting and natural language
   * 
   * @param appointment - The appointment to send reminder for
   * @param clinic - The clinic where appointment is booked
   * @param hoursBeforeAppointment - How many hours before appointment
   * @returns Formatted reminder message string
   */
  generateMessage(
    appointment: Appointment,
    clinic: Clinic,
    hoursBeforeAppointment: number,
  ): string {
    const appointmentDate = new Date(appointment.appointmentDate);
    const clinicAddress = clinic.address || 'the clinic';

    // Format date in British English
    const dayName = format(appointmentDate, 'EEEE'); // "Tuesday"
    const dateFormatted = format(appointmentDate, 'do MMMM'); // "15th March"
    const timeFormatted = appointment.appointmentTime; // "14:00"

    if (hoursBeforeAppointment === 1) {
      return this.generate1HourReminder(clinic.name, clinicAddress);
    }

    if (hoursBeforeAppointment === 24) {
      return this.generate24HourReminder(
        clinic.name,
        dayName,
        dateFormatted,
        timeFormatted,
        clinicAddress,
      );
    }

    if (hoursBeforeAppointment === 48) {
      return this.generate48HourReminder(
        clinic.name,
        dayName,
        dateFormatted,
        timeFormatted,
        clinicAddress,
      );
    }

    return this.generateCustomReminder(
      clinic.name,
      dayName,
      dateFormatted,
      timeFormatted,
      clinicAddress,
      hoursBeforeAppointment,
    );
  }

  /**
   * Generate 1-hour reminder - urgent and concise
   */
  private generate1HourReminder(clinicName: string, address: string): string {
    return `Just a reminder - your appointment is in 1 hour! ${clinicName}, ${address}.`;
  }

  /**
   * Generate 24-hour reminder - full details with reschedule option
   */
  private generate24HourReminder(
    clinicName: string,
    dayName: string,
    dateFormatted: string,
    timeFormatted: string,
    address: string,
  ): string {
    return (
      `Reminder: Your appointment at ${clinicName} is tomorrow ` +
      `(${dayName} ${dateFormatted}) at ${timeFormatted}. ` +
      `Address: ${address}. ` +
      `Reply if you need to reschedule or cancel.`
    );
  }

  /**
   * Generate 48-hour reminder - advance notice
   */
  private generate48HourReminder(
    clinicName: string,
    dayName: string,
    dateFormatted: string,
    timeFormatted: string,
    address: string,
  ): string {
    return (
      `Upcoming appointment: ${clinicName} on ${dayName} ${dateFormatted} ` +
      `at ${timeFormatted}. Address: ${address}. ` +
      `Reply if you need to reschedule or cancel.`
    );
  }

  /**
   * Generate custom interval reminder - generic format
   */
  private generateCustomReminder(
    clinicName: string,
    dayName: string,
    dateFormatted: string,
    timeFormatted: string,
    address: string,
    hoursBeforeAppointment: number,
  ): string {
    const daysUntil = Math.floor(hoursBeforeAppointment / 24);
    const timeReference =
      daysUntil > 0
        ? `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`
        : 'soon';

    return (
      `Reminder: Your appointment at ${clinicName} is ${timeReference} ` +
      `on ${dayName} ${dateFormatted} at ${timeFormatted}. ` +
      `Address: ${address}. Reply to reschedule or cancel.`
    );
  }
}