/**
 * DTOs for analytics query parameter validation.
 * Uses class-validator decorators to ensure query params are valid.
 */
import { IsOptional, IsIn, IsDateString } from 'class-validator';

/**
 * Query parameters for the GET /analytics/overview endpoint.
 * Supports period-based or custom date range filtering.
 */
export class OverviewQueryDto {
  /** Time period: 'day' (today), 'week' (last 7 days), or 'month' (last 30 days). */
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: string;

  /** Custom start date in ISO 8601 format (e.g. 2026-03-01). */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Custom end date in ISO 8601 format (e.g. 2026-03-15). */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /**
   * Comma-separated list of clinic IDs to restrict results to.
   * Used for staff-role filtering so staff only see their assigned clinics.
   */
  @IsOptional()
  clinicIds?: string;
}

/**
 * Query parameters for the GET /analytics/clinics/:clinicId endpoint.
 * Supports custom date range filtering only.
 */
export class ClinicAnalyticsQueryDto {
  /** Custom start date in ISO 8601 format. */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Custom end date in ISO 8601 format. */
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
