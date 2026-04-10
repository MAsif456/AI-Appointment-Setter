/**
 * Handles database tracking of reminder send attempts.
 * Extracted from ReminderService to maintain SRP and stay under 200 lines.
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from '../database/schemas/appointment.schema';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { MessagesService } from '../ghl/messages.service';

@Injectable()
export class ReminderTrackerService {

  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private messagesService: MessagesService,
  ) {}

  /**
   * Records a successful reminder send in the appointment reminders array
   * and persists the message to the messages collection.
   * @param appointment - The appointment the reminder was sent for
   * @param conversation - The conversation context to log to
   * @param clinic - The clinic config for the message log
   * @param reminderType - e.g. '24_hour' or '1_hour'
   * @param messageContent - The reminder message that was sent
   */
  async trackSent(
    appointment: AppointmentDocument,
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    reminderType: string,
    messageContent: string,
  ): Promise<void> {
    const sentAt = new Date();
    await this.appointmentModel.updateOne(
      { _id: appointment._id },
      { $push: { reminders: { sentAt, type: reminderType, status: 'sent' } } },
    );
    await this.conversationModel.updateOne(
      { _id: conversation._id },
      { $push: { remindersSent: { type: reminderType, sentAt } } },
    );
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
   * Records a failed reminder attempt in the appointment reminders array.
   * @param appointment - The appointment the reminder failed for
   * @param reminderType - e.g. '24_hour' or '1_hour'
   */
  async trackFailed(
    appointment: AppointmentDocument,
    reminderType: string,
  ): Promise<void> {
    await this.appointmentModel.updateOne(
      { _id: appointment._id },
      { $push: { reminders: { sentAt: new Date(), type: reminderType, status: 'failed' } } },
    );
  }
}