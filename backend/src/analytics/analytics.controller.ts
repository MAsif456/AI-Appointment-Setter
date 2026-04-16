/**
 * Controller for analytics API endpoints.
 *
 * Serves two distinct feature areas:
 * - Dashboard analytics: platform-wide overview, clinic comparison,
 *   and per-clinic analytics used by the Analytics page.
 * - Security events: the Lunax staff monitoring feed used to inspect
 *   rate-limit breaches and auth threats.
 *
 * The whole controller is marked with `@SensitiveData()` because the
 * security-events feed can include lead email addresses, IP addresses
 * and per-clinic usage patterns that we never want cached by browsers,
 * proxies or CDNs.
 *
 * Role-based filtering is enforced server-side: staff users are always
 * scoped to the clinics in their `assignedClinics` array regardless of
 * what they pass in the query string; admins see everything unless they
 * deliberately narrow via `?clinicIds=`.
 */
import {
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { OverviewAnalyticsService } from "./overview-analytics.service";
import { ClinicAnalyticsService } from "./clinic-analytics.service";
import { AnalyticsService, SecurityEventFilters } from "./analytics.service";
import {
  OverviewQueryDto,
  ClinicAnalyticsQueryDto,
} from "./dto/analytics-query.dto";
import { SensitiveData } from "../security-headers/sensitive-data.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@SensitiveData()
@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly overviewService: OverviewAnalyticsService,
    private readonly clinicService: ClinicAnalyticsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Resolves the effective clinic filter for the current user.
   * - Staff: always forced to `user.assignedClinics`, ignoring any client input.
   * - Admin: respects whatever (if anything) they pass through in `clinicIds`.
   * Returns `undefined` to mean "no filter" (admin, all clinics).
   */
  private resolveClinicIds(user: any, requested?: string): string | undefined {
    if (user?.role === "staff") {
      const assigned: string[] = (user.assignedClinics ?? []).map((id: any) =>
        id.toString(),
      );
      return assigned.join(",");
    }
    return requested;
  }

  /** Ensures a staff user is assigned to the clinic they are requesting. */
  private assertStaffCanSeeClinic(user: any, clinicId: string) {
    if (user?.role !== "staff") return;
    const assigned: string[] = (user.assignedClinics ?? []).map((id: any) =>
      id.toString(),
    );
    if (!assigned.includes(clinicId)) {
      throw new ForbiddenException("You are not assigned to this clinic.");
    }
  }

  /**
   * Returns platform-wide analytics metrics.
   * Supports period-based (week/month) or custom date range filtering.
   */
  @Get("overview")
  getOverview(@Query() query: OverviewQueryDto, @Req() req: any) {
    const clinicIds = this.resolveClinicIds(req.user, query.clinicIds);
    return this.overviewService.getOverview(
      query.period,
      query.startDate,
      query.endDate,
      clinicIds,
    );
  }

  /**
   * Returns comparison data for active clinics, filtered to the same
   * date window as the overview cards. Staff are scoped to their
   * assigned clinics automatically.
   */
  @Get("clinics")
  getClinicComparison(@Query() query: OverviewQueryDto, @Req() req: any) {
    const effective = this.resolveClinicIds(req.user, query.clinicIds);
    return this.overviewService.getClinicComparison(
      effective,
      query.period,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * Returns detailed analytics for a single clinic.
   * Rejects staff requests for clinics they are not assigned to.
   */
  @Get("clinics/:clinicId")
  getClinicAnalytics(
    @Param("clinicId") clinicId: string,
    @Query() query: ClinicAnalyticsQueryDto,
    @Req() req: any,
  ) {
    this.assertStaffCanSeeClinic(req.user, clinicId);
    return this.clinicService.getClinicAnalytics(
      clinicId,
      query.startDate,
      query.endDate,
    );
  }

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

    this.logger.log(`Security events query: ${JSON.stringify(filters)}`);

    return this.analyticsService.getSecurityEvents(filters);
  }
}
