import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment, AppointmentDocument } from '../database/schemas/appointment.schema';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { GhlApiService } from '../ghl/ghl-api.service';
import { ReminderTrackerService } from './reminder-tracker.service';
import { InboxNotificationService } from '../notifications/inbox-notification.service';
import { EncryptionService } from '../common/encryption/encryption.service';
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
    private inboxNotificationService: InboxNotificationService,
    private encryptionService: EncryptionService,
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

      const lead = conversation.leadId as any;
      const message = generateReminderMessage(appointment, clinic, hoursBeforeAppointment);
      let anySent = false;

      const apiKey = clinic.ghlApiKey ? this.encryptionService.decrypt(clinic.ghlApiKey) : '';

      try {
        await this.ghlApiService.sendMessageWithRetry(apiKey, {
          type: this.channelToGhlType(conversation.channel),
          contactId: conversation.ghlContactId,
          conversationId: conversation.ghlConversationId,
          locationId: clinic.ghlLocationId,
          message,
        });
        anySent = true;
        this.logger.log(`${conversation.channel.toUpperCase()} reminder sent for appointment ${appointment._id}`);
      } catch (channelError) {
        const body = channelError?.response?.data;
        this.logger.warn(
          `Channel (${conversation.channel}) reminder failed for appointment ${appointment._id}: ${channelError.message}` +
            (body ? ` | GHL: ${JSON.stringify(body)}` : ''),
        );
      }

      if (lead?.email && conversation.channel !== 'email') {
        try {
          const emailHtml = generateReminderEmailHtml(appointment, clinic, hoursBeforeAppointment);
          await this.ghlApiService.sendMessageWithRetry(apiKey, {
            type: 'Email',
            contactId: conversation.ghlContactId,
            conversationId: conversation.ghlConversationId,
            locationId: clinic.ghlLocationId,
            subject: `Appointment Reminder — ${clinic.name}`,
            message: emailHtml,
          });
          anySent = true;
          this.logger.log(`Email reminder sent for appointment ${appointment._id}`);
        } catch (emailError) {
          const body = emailError?.response?.data;
          this.logger.warn(
            `Email reminder failed for appointment ${appointment._id}: ${emailError.message}` +
              (body ? ` | GHL: ${JSON.stringify(body)}` : ''),
          );
        }
      }

      if (!anySent) {
        this.logger.error(`All reminder channels failed for appointment ${appointment._id}`);
        await this.reminderTrackerService.trackFailed(appointment, reminderType);
        return false;
      }

      await this.reminderTrackerService.trackSent(appointment, conversation, clinic, reminderType, message);

      this.inboxNotificationService.createForClinicStaff(
        appointment.clinicId.toString(),
        'appointment_reminder',
        'Appointment reminder sent',
        `Reminder sent for appointment on ${appointment.appointmentDate.toDateString()}`,
        appointment._id.toString(),
        'appointment',
      ).catch((err: Error) => this.logger.warn(`Failed to create reminder notification: ${err.message}`));

      return true;
    } catch (error) {
      const body = error?.response?.data;
      this.logger.error(
        `Failed to send reminder for appointment ${appointment._id}: ${error.message}` +
          (body ? ` | GHL response: ${JSON.stringify(body)}` : ''),
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

  /** Maps a conversation channel to the GHL message type string. */
  private channelToGhlType(channel: string): string {
    switch (channel) {
      case 'whatsapp': return 'WhatsApp';
      case 'facebook': return 'FB';
      case 'instagram': return 'IG';
      case 'email': return 'Email';
      default: return 'SMS'; // sms, website
    }
  }
}