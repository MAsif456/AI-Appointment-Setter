/**
 * Low-level Mongo aggregation helpers for the overview analytics service.
 *
 * Extracted as free functions so `OverviewAnalyticsService` stays focused
 * on orchestration (date-range resolution, scoping, response shaping) and
 * the aggregation pipelines can be unit-tested in isolation without the
 * Nest DI container.
 */
import { Model, Types } from 'mongoose';
import { Conversation } from '../database/schemas/conversation.schema';
import {
  QUALIFIED_PHASES,
  BOOKING_STARTED_PHASES,
  BOOKED_PHASES,
} from './analytics.constants';

/** Filter restricting an aggregation to a set of clinic IDs. */
export type ClinicFilter = { clinicId: { $in: Types.ObjectId[] } } | null;

/**
 * Picks a sensible `$dateTrunc` bucket for the bookings-over-time chart
 * so every preset looks readable:
 *   ≤ 10 days   → daily buckets
 *   11–35 days  → 5-day buckets (≈ 6 points for "last 30 days")
 *   36–120 days → weekly buckets
 *   > 120 days  → monthly buckets
 */
export function pickBucket(
  spanDays: number,
): { unit: 'day' | 'week' | 'month'; binSize: number } {
  if (spanDays <= 10) return { unit: 'day', binSize: 1 };
  if (spanDays <= 35) return { unit: 'day', binSize: 5 };
  if (spanDays <= 120) return { unit: 'week', binSize: 1 };
  return { unit: 'month', binSize: 1 };
}

/**
 * Aggregates booking counts over time in buckets scaled to the window.
 * Only conversations that reached a booked/confirmed phase are counted.
 */
export async function getBookingsOverTime(
  model: Model<Conversation>,
  startDate: Date,
  endDate: Date,
  clinicFilter: ClinicFilter = null,
) {
  const spanDays = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const { unit, binSize } = pickBucket(spanDays);

  return model.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        phase: { $in: BOOKED_PHASES },
        ...(clinicFilter ?? {}),
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$createdAt',
            unit,
            binSize,
            startOfWeek: 'monday',
            timezone: 'UTC',
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: { $dateToString: { format: '%Y-%m-%d', date: '$_id' } },
        count: 1,
      },
    },
  ]);
}

/**
 * Computes the four conversion-funnel stage counts in a single round-trip
 * using `$facet`. Returns zeros for any stage with no conversations.
 */
export async function getConversionFunnel(
  model: Model<Conversation>,
  startDate: Date,
  endDate: Date,
  clinicFilter: ClinicFilter = null,
) {
  const result = await model.aggregate([
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
