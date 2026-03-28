/**
 * Controller for analytics API endpoints.
 * Provides platform-wide overview, clinic comparison, and per-clinic analytics.
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { OverviewAnalyticsService } from './overview-analytics.service';
import { ClinicAnalyticsService } from './clinic-analytics.service';
import { OverviewQueryDto, ClinicAnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly overviewService: OverviewAnalyticsService,
    private readonly clinicService: ClinicAnalyticsService,
  ) {}

  /**
   * Returns platform-wide analytics metrics.
   * Supports period-based (week/month) or custom date range filtering.
   */
  @Get('overview')
  getOverview(@Query() query: OverviewQueryDto) {
    return this.overviewService.getOverview(
      query.period,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * Returns comparison data for all active clinics.
   * Used to populate the clinic comparison table on the analytics page.
   */
  @Get('clinics')
  getClinicComparison() {
    return this.overviewService.getClinicComparison();
  }

  /**
   * Returns detailed analytics for a single clinic.
   * Supports custom date range filtering via startDate/endDate query params.
   */
  @Get('clinics/:clinicId')
  getClinicAnalytics(
    @Param('clinicId') clinicId: string,
    @Query() query: ClinicAnalyticsQueryDto,
  ) {
    return this.clinicService.getClinicAnalytics(
      clinicId,
      query.startDate,
      query.endDate,
    );
  }
}
