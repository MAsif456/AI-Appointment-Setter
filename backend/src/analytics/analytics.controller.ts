import { Controller, Get, Query, Logger } from "@nestjs/common";
import { AnalyticsService, SecurityEventFilters } from "./analytics.service";
import { SensitiveData } from "../security-headers/sensitive-data.decorator";

/**
 * Analytics controller.
 * Exposes security event data for the Lunax staff dashboard.
 *
 * Marked with @SensitiveData() because the security-events feed can
 * include lead email addresses, IP addresses and per-clinic usage
 * patterns that we never want cached by browsers, proxies or CDNs.
 */
@SensitiveData()
@Controller("analytics")
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Returns security events with optional filtering.
   * Supports query params: eventType, ip, email, from, to, limit.
   *
   * @example GET /analytics/security-events?eventType=rate_limit_exceeded&limit=20
   */
  @Get("security-events")
  async getSecurityEvents(
    @Query("eventType") eventType?: string,
    @Query("ip") ip?: string,
    @Query("email") email?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    const filters: SecurityEventFilters = {
      eventType,
      ip,
      email,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    this.logger.log(
      `Security events query: ${JSON.stringify(filters)}`,
    );

    return this.analyticsService.getSecurityEvents(filters);
  }
}
