import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { differenceInHours } from 'date-fns';
import { Appointment, AppointmentDocument } from '../database/schemas/appointment.schema';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { GhlApiService } from '../ghl/ghl-api.service';
import { MessagesService } from '../ghl/messages.service';
import { generateReminderMessage } from './reminder.handler';

/**
 * Core service for appointment reminder management.
 * Finds appointments needing reminders and orchestrates sending them via GHL.
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
    private messagesService: MessagesService,
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

      const check = this.shouldSendReminder(
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
   * Determine if a reminder should be sent for this appointment.
   * AC: Check timing window (15min tolerance) and prevent duplicates.
   */
  private shouldSendReminder(
    appointment: AppointmentDocument,
    reminderTimes: number[],
  ): { send: boolean; type?: string; hoursBeforeAppointment?: number } {
    const now = new Date();
    const appointmentTime = new Date(appointment.appointmentDate);
    const hoursUntilAppointment = differenceInHours(appointmentTime, now);

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
        this.logger.error(
          `No GHL contact for appointment ${appointment._id}`,
        );
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

      // Send via GHL
      await this.ghlApiService.sendMessageWithRetry({
        type: conversation.channel === 'whatsapp' ? 'WhatsApp' : 'SMS',
        contactId: conversation.ghlContactId,
        message,
      });

      // Track successful send
      await this.trackReminderSent(
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
      await this.trackReminderFailed(appointment, reminderType);
      return false;
    }
  }

  /**
   * Track successful reminder send in appointment.reminders array and messages collection.
   */
  private async trackReminderSent(
    appointment: AppointmentDocument,
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    reminderType: string,
    messageContent: string,
  ): Promise<void> {
    const now = new Date();

    // Add to appointment.reminders array
    await this.appointmentModel.updateOne(
      { _id: appointment._id },
      {
        $push: {
          reminders: {
            sentAt: now,
            type: reminderType,
            status: 'sent',
          },
        },
      },
    );

    // Save to messages collection using your existing service
    await this.messagesService.addMessage(
      conversation._id as Types.ObjectId,
      clinic._id as Types.ObjectId,
      appointment.leadId as Types.ObjectId,
      'system',
      messageContent,
      conversation.channel,
    );
  }

  /**
   * Track failed reminder send in appointment.reminders array.
   */
  private async trackReminderFailed(
    appointment: AppointmentDocument,
    reminderType: string,
  ): Promise<void> {
    await this.appointmentModel.updateOne(
      { _id: appointment._id },
      {
        $push: {
          reminders: {
            sentAt: new Date(),
            type: reminderType,
            status: 'failed',
          },
        },
      },
    );
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

      const check = this.shouldSendReminder(
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