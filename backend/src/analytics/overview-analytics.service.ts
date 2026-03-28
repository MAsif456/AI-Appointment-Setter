/**
 * Service for platform-wide analytics aggregations.
 * Handles the overview endpoint and clinic comparison table.
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
  getPreviousPeriodRange,
  calcPercentageChange,
} from './analytics.constants';
import { OverviewResponse } from './dto/overview-response.dto';
import { ClinicComparisonRow } from './dto/overview-response.dto';

@Injectable()
export class OverviewAnalyticsService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(Lead.name) private leadModel: Model<Lead>,
    @InjectModel(Appointment.name) private appointmentModel: Model<Appointment>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  /**
   * Retrieves platform-wide analytics for a given period.
   * @param period - 'week' or 'month'
   * @param customStart - optional custom start date
   * @param customEnd - optional custom end date
   */
  async getOverview(
    period: string = 'week',
    customStart?: string,
    customEnd?: string,
  ): Promise<OverviewResponse> {
    const { startDate, endDate } = this.resolveDateRange(period, customStart, customEnd);
    const prev = getPreviousPeriodRange(startDate, endDate);

    // Run all queries in parallel for performance
    const [current, previous, bookingsOverTime, funnel] = await Promise.all([
      this.getPeriodMetrics(startDate, endDate),
      this.getPeriodMetrics(prev.startDate, prev.endDate),
      this.getBookingsOverTime(startDate, endDate),
      this.getConversionFunnel(startDate, endDate),
    ]);

    return {
      totalLeads: current.leads,
      totalBookings: current.bookings,
      conversionRate: current.conversionRate,
      avgResponseTime: current.avgResponseTime,
      comparison: {
        leadsChange: calcPercentageChange(current.leads, previous.leads),
        bookingsChange: calcPercentageChange(current.bookings, previous.bookings),
        conversionRateChange: calcPercentageChange(current.conversionRate, previous.conversionRate),
        avgResponseTimeChange: calcPercentageChange(current.avgResponseTime, previous.avgResponseTime),
      },
      bookingsOverTime,
      conversionFunnel: funnel,
    };
  }

  /**
   * Fetches per-clinic comparison data for the clinic comparison table.
   * Groups conversations by clinic and computes key metrics.
   */
  async getClinicComparison(): Promise<ClinicComparisonRow[]> {
    const results = await this.conversationModel.aggregate([
      {
        $group: {
          _id: '$clinicId',
          leads: { $sum: 1 },
          booked: {
            $sum: { $cond: [{ $in: ['$phase', BOOKED_PHASES] }, 1, 0] },
          },
          declined: {
            $sum: { $cond: [{ $eq: ['$phase', 'declined'] }, 1, 0] },
          },
          totalMessages: { $sum: '$messageCount' },
        },
      },
      { $lookup: { from: 'clinics', localField: '_id', foreignField: '_id', as: 'clinic' } },
      { $unwind: '$clinic' },
      { $match: { 'clinic.isActive': true } },
      { $sort: { 'clinic.name': 1 } },
    ]);

    return results.map((r) => ({
      clinicId: r._id.toString(),
      clinicName: r.clinic.name,
      leads: r.leads,
      bookings: r.booked,
      conversionRate: r.leads > 0 ? Math.round((r.booked / r.leads) * 100) : 0,
      avgMessages: r.leads > 0 ? Math.round(r.totalMessages / r.leads) : 0,
      declineRate: r.leads > 0 ? Math.round((r.declined / r.leads) * 100) : 0,
    }));
  }

  /** Resolves start/end dates from period or custom range. */
  private resolveDateRange(period: string, customStart?: string, customEnd?: string) {
    if (customStart && customEnd) {
      const startDate = new Date(customStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
    return getDateRange(period);
  }

  /** Fetches lead count, booking count, conversion rate, and avg response time for a date range. */
  private async getPeriodMetrics(startDate: Date, endDate: Date) {
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };

    const [leads, bookings, avgResp] = await Promise.all([
      this.leadModel.countDocuments(dateFilter),
      this.appointmentModel.countDocuments({
        ...dateFilter,
        status: { $in: VALID_BOOKING_STATUSES },
      }),
      this.messageModel.aggregate([
        { $match: { ...dateFilter, sender: 'ai', responseTimeSeconds: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$responseTimeSeconds' } } },
      ]),
    ]);

    const avgResponseTime = avgResp.length > 0 ? Math.round(avgResp[0].avg) : 0;
    const conversionRate = leads > 0 ? Math.round((bookings / leads) * 100) : 0;

    return { leads, bookings, conversionRate, avgResponseTime };
  }

  /** Aggregates daily booking counts for the time-series chart. */
  private async getBookingsOverTime(startDate: Date, endDate: Date) {
    const results = await this.appointmentModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: VALID_BOOKING_STATUSES },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ]);
    return results;
  }

  /** Computes conversion funnel counts using $facet for a single DB round trip. */
  private async getConversionFunnel(startDate: Date, endDate: Date) {
    const result = await this.conversationModel.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $facet: {
          leads: [{ $count: 'count' }],
          qualified: [
            { $match: { phase: { $in: QUALIFIED_PHASES } } },
            { $count: 'count' },
          ],
          bookingStarted: [
            { $match: { phase: { $in: BOOKING_STARTED_PHASES } } },
            { $count: 'count' },
          ],
          booked: [
            { $match: { phase: { $in: BOOKED_PHASES } } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const facet = result[0] || {};
    return {
      leads: facet.leads?.[0]?.count ?? 0,
      qualified: facet.qualified?.[0]?.count ?? 0,
      bookingStarted: facet.bookingStarted?.[0]?.count ?? 0,
      booked: facet.booked?.[0]?.count ?? 0,
    };
  }
}
