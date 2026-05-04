import { validate } from 'class-validator';
import { OverviewQueryDto, ClinicAnalyticsQueryDto } from './analytics-query.dto';

/**
 * Unit tests for analytics query DTOs.
 * Validates class-validator decorators accept valid inputs and reject invalid ones.
 */
describe('OverviewQueryDto', () => {
  it('should accept empty query (all fields optional)', async () => {
    const dto = new OverviewQueryDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept period "week"', async () => {
    const dto = Object.assign(new OverviewQueryDto(), { period: 'week' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept period "month"', async () => {
    const dto = Object.assign(new OverviewQueryDto(), { period: 'month' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid period value', async () => {
    const dto = Object.assign(new OverviewQueryDto(), { period: 'year' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('period');
  });

  it('should accept valid ISO date strings', async () => {
    const dto = Object.assign(new OverviewQueryDto(), {
      startDate: '2026-03-01', endDate: '2026-03-15',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid date string for startDate', async () => {
    const dto = Object.assign(new OverviewQueryDto(), { startDate: 'not-a-date' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('startDate');
  });

  it('should reject invalid date string for endDate', async () => {
    const dto = Object.assign(new OverviewQueryDto(), { endDate: 'invalid' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('endDate');
  });
});

describe('ClinicAnalyticsQueryDto', () => {
  it('should accept empty query', async () => {
    const dto = new ClinicAnalyticsQueryDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid date range', async () => {
    const dto = Object.assign(new ClinicAnalyticsQueryDto(), {
      startDate: '2026-03-01', endDate: '2026-03-15',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid startDate', async () => {
    const dto = Object.assign(new ClinicAnalyticsQueryDto(), { startDate: 'bad' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('should reject invalid endDate', async () => {
    const dto = Object.assign(new ClinicAnalyticsQueryDto(), { endDate: '123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
