/**
 * Service for per-clinic analytics aggregations.
 * Handles the individual clinic analytics endpoint.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from '../database/schemas/conversation.schema';
import { Lead } from '../database/schemas/lead.schema';
import { Appointment } from '../database/schemas/appointment.schema';
import { Message } from '../database/schemas/message.schema';
import {
  QUALIFIED_PHASES,
  BOOKING_STARTED_PHASES,
  BOOKED_PHASES,
  VALID_BOOKING_STATUSES,
  getDateRange,
} from './analytics.constants';
import { ClinicAnalyticsResponse } from './dto/clinic-response.dto';

@Injectable()
export class ClinicAnalyticsService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(Lead.name) private leadModel: Model<Lead>,
    @InjectModel(Appointment.name) private appointmentModel: Model<Appointment>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  /**
   * Retrieves analytics for a single clinic.
   * @param clinicId - the clinic's MongoDB _id
   * @param customStart - optional ISO date string for range start
   * @param customEnd - optional ISO date string for range end
   */
  async getClinicAnalytics(
    clinicId: string,
    customStart?: string,
    customEnd?: string,
  ): Promise<ClinicAnalyticsResponse> {
    this.assertValidObjectId(clinicId);

    const { startDate, endDate } = this.resolveDateRange(customStart, customEnd);
    const objectId = new Types.ObjectId(clinicId);

    // Run all queries in parallel for performance
    const [leads, bookings, avgResp, bookingsOverTime, funnel, phases, sources, avgMsgs] =
      await Promise.all([
        this.countLeads(objectId, startDate, endDate),
        this.countBookings(objectId, startDate, endDate),
        this.getAvgResponseTime(objectId, startDate, endDate),
        this.getBookingsOverTime(objectId, startDate, endDate),
        this.getConversionFunnel(objectId, startDate, endDate),
        this.getPhaseDistribution(objectId, startDate, endDate),
        this.getLeadSources(objectId, startDate, endDate),
        this.getAvgMessagesToBooking(objectId, startDate, endDate),
      ]);

    const declinedCount = phases.find((p) => p.phase === 'declined')?.count ?? 0;

    return {
      leads,
      bookings,
      conversionRate: leads > 0 ? Math.round((bookings / leads) * 100) : 0,
      avgResponseTime: avgResp,
      bookingsOverTime,
      funnel,
      conversationPhaseDistribution: phases,
      leadSources: sources,
      avgMessagesToBooking: avgMsgs,
      declineRate: leads > 0 ? Math.round((declinedCount / leads) * 100) : 0,
    };
  }

  /** Validates that the provided ID is a valid 24-character hex string. */
  private assertValidObjectId(id: string): void {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new BadRequestException('Invalid clinic ID format');
    }
  }

  /** Resolves date range from custom params or defaults to last 30 days. */
  private resolveDateRange(customStart?: string, customEnd?: string) {
    if (customStart && customEnd) {
      const startDate = new Date(customStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
    return getDateRange('month');
  }

  private async countLeads(clinicId: Types.ObjectId, start: Date, end: Date) {
    return this.leadModel.countDocuments({
      clinicId, createdAt: { $gte: start, $lte: end },
    });
  }

  private async countBookings(clinicId: Types.ObjectId, start: Date, end: Date) {
    return this.appointmentModel.countDocuments({
      clinicId, createdAt: { $gte: start, $lte: end },
      status: { $in: VALID_BOOKING_STATUSES },
    });
  }

  private async getAvgResponseTime(clinicId: Types.ObjectId, start: Date, end: Date) {
    const result = await this.messageModel.aggregate([
      { $match: { clinicId, createdAt: { $gte: start, $lte: end }, sender: 'ai', responseTimeSeconds: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$responseTimeSeconds' } } },
    ]);
    return result.length > 0 ? Math.round(result[0].avg) : 0;
  }

  private async getBookingsOverTime(clinicId: Types.ObjectId, start: Date, end: Date) {
    return this.appointmentModel.aggregate([
      { $match: { clinicId, createdAt: { $gte: start, $lte: end }, status: { $in: VALID_BOOKING_STATUSES } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ]);
  }

  private async getConversionFunnel(clinicId: Types.ObjectId, start: Date, end: Date) {
    const result = await this.conversationModel.aggregate([
      { $match: { clinicId, createdAt: { $gte: start, $lte: end } } },
      {
        $facet: {
          leads: [{ $count: 'count' }],
          qualified: [{ $match: { phase: { $in: QUALIFIED_PHASES } } }, { $count: 'count' }],
          bookingStarted: [{ $match: { phase: { $in: BOOKING_STARTED_PHASES } } }, { $count: 'count' }],
          booked: [{ $match: { phase: { $in: BOOKED_PHASES } } }, { $count: 'count' }],
        },
      },
    ]);
    const f = result[0] || {};
    return {
      leads: f.leads?.[0]?.count ?? 0,
      qualified: f.qualified?.[0]?.count ?? 0,
      bookingStarted: f.bookingStarted?.[0]?.count ?? 0,
      booked: f.booked?.[0]?.count ?? 0,
    };
  }

  private async getPhaseDistribution(clinicId: Types.ObjectId, start: Date, end: Date) {
    return this.conversationModel.aggregate([
      { $match: { clinicId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$phase', count: { $sum: 1 } } },
      { $project: { _id: 0, phase: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]);
  }

  private async getLeadSources(clinicId: Types.ObjectId, start: Date, end: Date) {
    const results = await this.leadModel.aggregate([
      { $match: { clinicId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$leadSource', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const total = results.reduce((sum, r) => sum + r.count, 0);
    return results.map((r) => ({
      source: r._id || 'unknown',
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
    }));
  }

  private async getAvgMessagesToBooking(clinicId: Types.ObjectId, start: Date, end: Date) {
    const result = await this.conversationModel.aggregate([
      { $match: { clinicId, createdAt: { $gte: start, $lte: end }, phase: { $in: BOOKED_PHASES } } },
      { $group: { _id: null, avg: { $avg: '$messageCount' } } },
    ]);
    return result.length > 0 ? Math.round(result[0].avg) : 0;
  }
}
