import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment, AppointmentDocument } from '../database/schemas/appointment.schema';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { GhlApiService } from '../ghl/ghl-api.service';
import { ReminderTrackerService } from './reminder-tracker.service';
import { generateReminderMessage, generateReminderEmailHtml, shouldSendReminder } from './reminder.handler';

/**
 * Core service for appointment reminder management.
 * Finds appointments needing reminders and orchestrates sending them via GHL.
 * Tracking is delegated to ReminderTrackerService to maintain SRP.
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(Clinic.name)
    private clinicModel: Model<ClinicDocument>,
    private ghlApiService: GhlApiService,
    private reminderTrackerService: ReminderTrackerService,
  ) {}

  /**
   * Find all appointments that need reminders sent right now.
   * AC: Only confirmed appointments, with enabled reminders, not already sent.
   */
  async findAppointmentsNeedingReminders(): Promise<AppointmentDocument[]> {
    const now = new Date();

    // AC: Don't send reminders for cancelled appointments
    const appointments = await this.appointmentModel
      .find({
        status: 'confirmed',
        appointmentDate: { $gt: now },
      })
      .populate('clinicId')
      .exec();

    const needingReminders: AppointmentDocument[] = [];

    for (const appointment of appointments) {
      const clinic = appointment.clinicId as any;

      if (!clinic?.reminderSettings?.enabled) {
        continue;
      }

      const check = shouldSendReminder(
        appointment,
        clinic.reminderSettings.reminderTimes,
      );

      if (check.send) {
        needingReminders.push(appointment);
      }
    }

    return needingReminders;
  }

  /**
   * Send a reminder message via GHL and track the result.
   * AC: Generate message, send via GHL, track in appointment.reminders array.
   */
  async sendReminder(
    appointment: AppointmentDocument,
    reminderType: string,
    hoursBeforeAppointment: number,
  ): Promise<boolean> {
    try {
      const conversation = await this.conversationModel
        .findOne({ appointmentId: appointment._id })
        .populate('leadId')
        .exec();

      if (!conversation?.ghlContactId) {
        this.logger.error(`No GHL contact for appointment ${appointment._id}`);
        return false;
      }

      const clinic = await this.clinicModel.findById(appointment.clinicId).exec();
      if (!clinic) {
        this.logger.error(`Clinic not found for appointment ${appointment._id}`);
        return false;
      }

      // Generate reminder message
      const message = generateReminderMessage(
        appointment,
        clinic,
        hoursBeforeAppointment,
      );

      // Resolve GHL message type — prefer lead's channel, fall back to SMS
      const lead = conversation.leadId as any;
      const channel = lead?.preferredChannel ?? conversation.channel;
      const ghlType = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';

      // Send via GHL (SMS or WhatsApp)
      await this.ghlApiService.sendMessageWithRetry({
        type: ghlType,
        contactId: conversation.ghlContactId,
        message,
      });

      // Also send email reminder if the lead has an email address
      if (lead?.email) {
        try {
          const emailHtml = generateReminderEmailHtml(appointment, clinic, hoursBeforeAppointment);
          await this.ghlApiService.sendMessageWithRetry({
            type: 'Email',
            contactId: conversation.ghlContactId,
            subject: `Appointment Reminder — ${clinic.name}`,
            message: emailHtml,
          });
          this.logger.log(`Email reminder sent for appointment ${appointment._id}`);
        } catch (emailError) {
          this.logger.warn(
            `Email reminder failed for appointment ${appointment._id}: ${emailError.message}`,
          );
        }
      }

      // Track successful send
      await this.reminderTrackerService.trackSent(
        appointment,
        conversation,
        clinic,
        reminderType,
        message,
      );

      this.logger.log(
        `Reminder sent for appointment ${appointment._id}, ${hoursBeforeAppointment}h before`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send reminder for appointment ${appointment._id}: ${error.message}`,
      );
      await this.reminderTrackerService.trackFailed(appointment, reminderType);
      return false;
    }
  }

  /**
   * Main entry point: process all appointments and send reminders.
   * AC: Called by scheduler every 15 minutes.
   */
  async processReminders(): Promise<{ sent: number; failed: number }> {
    const appointments = await this.findAppointmentsNeedingReminders();

    let sent = 0;
    let failed = 0;

    this.logger.log(`Found ${appointments.length} appointments needing reminders`);

    for (const appointment of appointments) {
      const clinic = appointment.clinicId as any;
      if (!clinic) continue;

      const check = shouldSendReminder(
        appointment,
        clinic.reminderSettings.reminderTimes,
      );

      if (check.send) {
        const success = await this.sendReminder(
          appointment,
          check.type!,
          check.hoursBeforeAppointment!,
        );

        if (success) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    this.logger.log(`Reminders processed: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }
}