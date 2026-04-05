import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { differenceInHours } from 'date-fns';
import { Appointment } from '../database/schemas/appointment.schema';
import { Message } from '../database/schemas/message.schema';
import { Conversation } from '../database/schemas/conversation.schema';

/**
 * Interface for upcoming reminder data structure
 * Defines shape of reminder information returned to dashboard
 */
interface UpcomingReminderDto {
  conversationId: Types.ObjectId | undefined;
  leadName: string;
  clinicName: string;
  appointmentTime: string;
  reminderType: string;
  scheduledFor: string;
}

/**
 * Service for generating reminder analytics and statistics
 * Used by the dashboard to display reminder performance metrics
 */
@Injectable()
export class ReminderAnalyticsService {
  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<Appointment>,
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
  ) {}

  /**
   * Get reminder statistics for dashboard
   * Returns counts of scheduled, sent, and failed reminders
   */
  async getReminderStats(): Promise<{
    totalScheduled: number;
    sentToday: number;
    failedToday: number;
    upcomingNext24h: number;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const totalScheduled = await this.appointmentModel
      .countDocuments({
        status: 'confirmed',
        appointmentDate: { $gt: now },
      })
      .exec();

    const sentToday = await this.messageModel
      .countDocuments({
        isReminder: true,
        status: 'sent',
        createdAt: { $gte: todayStart },
      })
      .exec();

    const failedToday = await this.messageModel
      .countDocuments({
        isReminder: true,
        status: 'failed',
        createdAt: { $gte: todayStart },
      })
      .exec();

    const appointmentsNext24h = await this.appointmentModel
      .find({
        status: 'confirmed',
        appointmentDate: { $gt: now, $lt: next24Hours },
      })
      .populate('clinicId')
      .exec();

    let upcomingNext24h = 0;
    for (const appt of appointmentsNext24h) {
      const clinic = appt.clinicId as any;
      if (clinic?.reminderSettings?.enabled) {
        const hasUnsentReminder = clinic.reminderSettings.reminderTimes.some(
          (interval: number) => {
            const alreadySent = appt.reminders?.some(
              (r) => r.type === `${interval}_hour` && r.status === 'sent',
            );
            return !alreadySent;
          },
        );
        if (hasUnsentReminder) {
          upcomingNext24h++;
        }
      }
    }

    return {
      totalScheduled,
      sentToday,
      failedToday,
      upcomingNext24h,
    };
  }

  /**
   * Get detailed reminder logs for a specific appointment
   */
  async getAppointmentReminderHistory(appointmentId: string): Promise<any> {
    const appointment = await this.appointmentModel
      .findById(appointmentId)
      .populate('clinicId')
      .populate('leadId')
      .exec();

    if (!appointment) {
      return null;
    }

    const conversation = await this.conversationModel
      .findOne({
        appointmentId: new Types.ObjectId(appointmentId),
      })
      .exec();

    const reminderMessages = await this.messageModel
      .find({
        conversationId: conversation?._id,
        isReminder: true,
      })
      .sort({ createdAt: 1 })
      .exec();

    return {
      appointment: {
        id: (appointment as any)._id,
        date: appointment.appointmentDate,
        time: appointment.appointmentTime,
        status: appointment.status,
      },
      remindersConfigured:
        (appointment.clinicId as any)?.reminderSettings?.reminderTimes || [],
      remindersSent: appointment.reminders || [],
      messageHistory: reminderMessages.map((msg) => ({
        sentAt: (msg as any).createdAt,
        content: msg.content,
        status: msg.status,
        channel: msg.channel,
      })),
    };
  }

  /**
   * Get clinic-specific reminder performance
   */
  async getClinicReminderStats(
    clinicId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = endDate;

    const query: any = { clinicId: new Types.ObjectId(clinicId) };
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }

    const totalReminders = await this.messageModel
      .countDocuments({
        ...query,
        isReminder: true,
      })
      .exec();

    const successfulReminders = await this.messageModel
      .countDocuments({
        ...query,
        isReminder: true,
        status: 'sent',
      })
      .exec();

    const failedReminders = await this.messageModel
      .countDocuments({
        ...query,
        isReminder: true,
        status: 'failed',
      })
      .exec();

    const successRate =
      totalReminders > 0 ? (successfulReminders / totalReminders) * 100 : 0;

    return {
      totalReminders,
      successfulReminders,
      failedReminders,
      successRate: Math.round(successRate * 10) / 10,
    };
  }

  /**
   * Get upcoming reminders for dashboard display
   * Returns reminders scheduled for the next 24 hours
   */
  async getUpcomingReminders(limit: number = 20): Promise<UpcomingReminderDto[]> {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await this.appointmentModel
      .find({
        status: 'confirmed',
        appointmentDate: { $gt: now, $lt: next24Hours },
      })
      .populate('clinicId')
      .populate('leadId')
      .limit(limit)
      .exec();

    const upcomingReminders: UpcomingReminderDto[] = [];

    for (const appointment of appointments) {
      const clinic = appointment.clinicId as any;
      const lead = appointment.leadId as any;

      if (!clinic?.reminderSettings?.enabled) continue;

      const hoursUntil = differenceInHours(appointment.appointmentDate, now);

      for (const interval of clinic.reminderSettings.reminderTimes) {
        const alreadySent = appointment.reminders?.some(
          (r) => r.type === `${interval}_hour` && r.status === 'sent',
        );

        if (!alreadySent && hoursUntil <= interval) {
          const conversation = await this.conversationModel
            .findOne({
              appointmentId: (appointment as any)._id,
            })
            .exec();

          upcomingReminders.push({
            conversationId: conversation?._id,
            leadName: lead?.name || 'Unknown',
            clinicName: clinic.name,
            appointmentTime: appointment.appointmentDate.toISOString(),
            reminderType: `${interval}_hour`,
            scheduledFor: new Date(
              appointment.appointmentDate.getTime() -
                interval * 60 * 60 * 1000,
            ).toISOString(),
          });
        }
      }
    }

    return upcomingReminders;
  }
}