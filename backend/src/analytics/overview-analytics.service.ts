/**
 * Service for platform-wide analytics aggregations.
 * Handles the overview endpoint and clinic comparison table.
 * Uses conversations as the single source of truth for consistency.
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Conversation } from '../database/schemas/conversation.schema';
import { Message } from '../database/schemas/message.schema';
import {
  QUALIFIED_PHASES,
  BOOKING_STARTED_PHASES,
  BOOKED_PHASES,
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
    clinicIds?: string,
  ): Promise<OverviewResponse> {
    const { startDate, endDate } = this.resolveDateRange(period, customStart, customEnd);
    const prev = getPreviousPeriodRange(startDate, endDate);
    const clinicFilter = this.buildClinicFilter(clinicIds);

    // Run all queries in parallel for performance
    const [current, previous, bookingsOverTime, funnel] = await Promise.all([
      this.getPeriodMetrics(startDate, endDate, clinicFilter),
      this.getPeriodMetrics(prev.startDate, prev.endDate, clinicFilter),
      this.getBookingsOverTime(startDate, endDate, clinicFilter),
      this.getConversionFunnel(startDate, endDate, clinicFilter),
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
  async getClinicComparison(clinicIds?: string): Promise<ClinicComparisonRow[]> {
    const clinicFilter = this.buildClinicFilter(clinicIds);
    const results = await this.conversationModel.aggregate([
      ...(clinicFilter ? [{ $match: clinicFilter }] : []),
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

  /**
   * Parses a comma-separated clinic ID string into a Mongo `$in` filter.
   * Returns `null` when no filter should be applied (admin view / all clinics).
   */
  private buildClinicFilter(clinicIds?: string): { clinicId: { $in: Types.ObjectId[] } } | null {
    if (!clinicIds) return null;
    const ids = clinicIds
      .split(',')
      .map((s) => s.trim())
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));
    if (ids.length === 0) return null;
    return { clinicId: { $in: ids } };
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
  private async getPeriodMetrics(
    startDate: Date,
    endDate: Date,
    clinicFilter: { clinicId: { $in: Types.ObjectId[] } } | null = null,
  ) {
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    const baseFilter = { ...dateFilter, ...(clinicFilter ?? {}) };

    // Use conversations as single source of truth for leads and bookings
    const [leads, bookings, avgResp] = await Promise.all([
      this.conversationModel.countDocuments(baseFilter),
      this.conversationModel.countDocuments({
        ...baseFilter,
        phase: { $in: BOOKED_PHASES },
      }),
      this.messageModel.aggregate([
        { $match: { ...baseFilter, sender: 'ai', responseTimeSeconds: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$responseTimeSeconds' } } },
      ]),
    ]);

    const avgResponseTime = avgResp.length > 0 ? Math.round(avgResp[0].avg) : 0;
    const conversionRate = leads > 0 ? Math.round((bookings / leads) * 100) : 0;

    return { leads, bookings, conversionRate, avgResponseTime };
  }

  /** Aggregates daily booking counts from conversations that reached booked phase. */
  private async getBookingsOverTime(
    startDate: Date,
    endDate: Date,
    clinicFilter: { clinicId: { $in: Types.ObjectId[] } } | null = null,
  ) {
    const results = await this.conversationModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          phase: { $in: BOOKED_PHASES },
          ...(clinicFilter ?? {}),
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
  private async getConversionFunnel(
    startDate: Date,
    endDate: Date,
    clinicFilter: { clinicId: { $in: Types.ObjectId[] } } | null = null,
  ) {
    const result = await this.conversationModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          ...(clinicFilter ?? {}),
        },
      },
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
