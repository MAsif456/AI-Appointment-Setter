/**
 * Service for platform-wide analytics aggregations.
 * Handles the overview endpoint and the clinic-comparison table.
 * Conversations are the single source of truth so overview totals and
 * clinic-comparison rows always agree for the same window.
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clinic } from '../database/schemas/clinic.schema';
import { Conversation } from '../database/schemas/conversation.schema';
import {
  BOOKED_PHASES,
  getDateRange,
  getPreviousPeriodRange,
  calcPercentageChange,
} from './analytics.constants';
import { ClinicFilter, getBookingsOverTime, getConversionFunnel } from './overview-aggregations';
import { OverviewResponse, ClinicComparisonRow } from './dto/overview-response.dto';

@Injectable()
export class OverviewAnalyticsService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Clinic.name) private clinicModel: Model<Clinic>,
  ) {}

  /** Retrieves platform-wide analytics for a given period or custom range. */
  async getOverview(
    period: string = 'week',
    customStart?: string,
    customEnd?: string,
    clinicIds?: string,
  ): Promise<OverviewResponse> {
    const { startDate, endDate } = this.resolveDateRange(period, customStart, customEnd);
    const prev = getPreviousPeriodRange(startDate, endDate);
    const activeIds = await this.resolveActiveClinicIds(clinicIds);
    const clinicFilter: ClinicFilter = { clinicId: { $in: activeIds } };

    const [current, previous, bookingsOverTime, funnel] = await Promise.all([
      this.getPeriodMetrics(startDate, endDate, clinicFilter),
      this.getPeriodMetrics(prev.startDate, prev.endDate, clinicFilter),
      getBookingsOverTime(this.conversationModel, startDate, endDate, clinicFilter),
      getConversionFunnel(this.conversationModel, startDate, endDate, clinicFilter),
    ]);

    return {
      totalLeads: current.leads,
      totalBookings: current.bookings,
      conversionRate: current.conversionRate,
      avgMessagesToBooking: current.avgMessagesToBooking,
      comparison: {
        leadsChange: calcPercentageChange(current.leads, previous.leads),
        bookingsChange: calcPercentageChange(current.bookings, previous.bookings),
        conversionRateChange: calcPercentageChange(
          current.conversionRate,
          previous.conversionRate,
        ),
        avgMessagesToBookingChange: calcPercentageChange(
          current.avgMessagesToBooking,
          previous.avgMessagesToBooking,
        ),
      },
      bookingsOverTime,
      conversionFunnel: funnel,
    };
  }

  /**
   * Fetches per-clinic comparison data for the clinic-comparison table.
   * Groups conversations by clinic then joins the Clinic collection so
   * only active clinics appear, and sorts the result by clinic name.
   */
  async getClinicComparison(
    clinicIds?: string,
    period: string = 'week',
    customStart?: string,
    customEnd?: string,
  ): Promise<ClinicComparisonRow[]> {
    const activeIds = await this.resolveActiveClinicIds(clinicIds);
    const { startDate, endDate } = this.resolveDateRange(period, customStart, customEnd);

    // Active-clinic + date-range filter applied first so the table rows
    // sum to exactly the overview totals for the same window.
    const results = await this.conversationModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          clinicId: { $in: activeIds },
        },
      },
      {
        $group: {
          _id: '$clinicId',
          leads: { $sum: 1 },
          booked: { $sum: { $cond: [{ $in: ['$phase', BOOKED_PHASES] }, 1, 0] } },
          declined: { $sum: { $cond: [{ $eq: ['$phase', 'declined'] }, 1, 0] } },
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
   * Returns the ObjectId list of all active clinics, intersected with a
   * caller-supplied `clinicIds` string when present. Used as the single
   * source of truth for every aggregation so cards and comparison rows
   * agree on which clinics contribute to the totals.
   */
  private async resolveActiveClinicIds(
    clinicIds?: string,
  ): Promise<Types.ObjectId[]> {
    const active = await this.clinicModel
      .find({ isActive: true })
      .select('_id')
      .lean()
      .exec();
    const activeIds = active.map((c) => c._id as Types.ObjectId);

    if (!clinicIds) return activeIds;

    const requested = clinicIds
      .split(',')
      .map((s) => s.trim())
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));
    if (requested.length === 0) return activeIds;

    // Intersect: respect staff scoping while still excluding inactive clinics.
    const requestedSet = new Set(requested.map((id) => id.toString()));
    return activeIds.filter((id) => requestedSet.has(id.toString()));
  }

  /** Resolves start/end dates from a period label or a custom range. */
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

  /**
   * Fetches lead count, booking count, conversion rate and average
   * messages-to-booking for the given window. Average messages-to-booking
   * is the mean `messageCount` across conversations that reached a
   * booked/confirmed phase — the metric the client actually values.
   */
  private async getPeriodMetrics(
    startDate: Date,
    endDate: Date,
    clinicFilter: ClinicFilter = null,
  ) {
    const baseFilter = {
      createdAt: { $gte: startDate, $lte: endDate },
      ...(clinicFilter ?? {}),
    };

    const [leads, bookings, avgMsgs] = await Promise.all([
      this.conversationModel.countDocuments(baseFilter),
      this.conversationModel.countDocuments({
        ...baseFilter,
        phase: { $in: BOOKED_PHASES },
      }),
      this.conversationModel.aggregate([
        { $match: { ...baseFilter, phase: { $in: BOOKED_PHASES } } },
        { $group: { _id: null, avg: { $avg: '$messageCount' } } },
      ]),
    ]);

    const avgMessagesToBooking = avgMsgs.length > 0 ? Math.round(avgMsgs[0].avg) : 0;
    const conversionRate = leads > 0 ? Math.round((bookings / leads) * 100) : 0;

    return { leads, bookings, conversionRate, avgMessagesToBooking };
  }
}
