import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment } from '../database/schemas/appointment.schema';
import { Conversation } from '../database/schemas/conversation.schema';
import { MessagesService } from '../ghl/messages.service'; // ← Use your existing service

/**
 * Service responsible for tracking sent and failed reminders
 * Updates Appointment.reminders array and creates Message documents
 */
@Injectable()
export class ReminderTrackerService {
  private readonly logger = new Logger(ReminderTrackerService.name);

  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<Appointment>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    private messagesService: MessagesService, // ← Use existing service
  ) {}

  /**
   * Track that a reminder has been sent successfully
   * Updates appointment reminders array and creates message record
   */
  async trackReminderSent(
    appointment: Appointment,
    conversation: Conversation,
    reminderType: string,
    messageContent: string,
  ): Promise<void> {
    const now = new Date();

    try {
      // Add reminder to appointment tracking array
      await this.appointmentModel
        .updateOne(
          { _id: (appointment as any)._id },
          {
            $push: {
              reminders: {
                sentAt: now,
                type: reminderType,
                status: 'sent',
              },
            },
          },
        )
        .exec();

      // Use existing MessagesService to create message record
      await this.messagesService.addMessage(
        (conversation as any)._id,
        appointment.clinicId as Types.ObjectId,
        appointment.leadId as Types.ObjectId,
        'system',
        messageContent,
        conversation.channel,
      );

      this.logger.log(
        `Reminder tracked for appointment ${(appointment as any)._id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track sent reminder for appointment ${(appointment as any)._id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Track that a reminder failed to send
   * Records the failure in appointment reminders array
   */
  async trackReminderFailed(
    appointment: Appointment,
    reminderType: string,
  ): Promise<void> {
    try {
      await this.appointmentModel
        .updateOne(
          { _id: (appointment as any)._id },
          {
            $push: {
              reminders: {
                sentAt: new Date(),
                type: reminderType,
                status: 'failed',
              },
            },
          },
        )
        .exec();

      this.logger.warn(
        `Reminder failed for appointment ${(appointment as any)._id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track failed reminder for appointment ${(appointment as any)._id}: ${error.message}`,
      );
    }
  }
}