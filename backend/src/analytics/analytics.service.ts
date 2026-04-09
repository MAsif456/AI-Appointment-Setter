import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  SecurityEvent,
  SecurityEventDocument,
} from "./schemas/security-event.schema";

/** Filter options for querying security events. */
export interface SecurityEventFilters {
  eventType?: string;
  ip?: string;
  email?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(SecurityEvent.name)
    private readonly securityEventModel: Model<SecurityEventDocument>,
  ) {}

  /**
   * Logs a security event to MongoDB.
   * Fire-and-forget: errors are caught and logged, never thrown.
   * @param event - Partial security event data to persist.
   */
  async logSecurityEvent(event: Partial<SecurityEvent>): Promise<void> {
    try {
      await this.securityEventModel.create(event);
    } catch (error) {
      this.logger.warn(
        `Failed to log security event: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Queries security events with optional filtering.
   * Returns results sorted by createdAt descending (newest first).
   * @param filters - Optional filters for eventType, ip, email, date range.
   * @returns Array of matching SecurityEvent documents.
   */
  async getSecurityEvents(
    filters: SecurityEventFilters,
  ): Promise<SecurityEvent[]> {
    const query: Record<string, any> = {};

    if (filters.eventType) {
      query.eventType = filters.eventType;
    }
    if (filters.ip) {
      query.ip = filters.ip;
    }
    if (filters.email) {
      query.email = filters.email;
    }

    // Date range filter on createdAt
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) {
        query.createdAt.$gte = filters.from;
      }
      if (filters.to) {
        query.createdAt.$lte = filters.to;
      }
    }

    const limit = filters.limit ?? 50;

    return this.securityEventModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }
}
