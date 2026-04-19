/**
 * Unit tests for analytics constants and date-range helpers.
 * Verifies getDateRange, getPreviousPeriodRange, and calcPercentageChange
 * for all supported periods including the new 'day' variant.
 */
import {
  getDateRange,
  getPreviousPeriodRange,
  calcPercentageChange,
  BOOKED_PHASES,
  QUALIFIED_PHASES,
} from './analytics.constants';

describe('analytics.constants', () => {
  describe('getDateRange', () => {
    it('should return a single-day window for period "day"', () => {
      const { startDate, endDate } = getDateRange('day');

      // Both dates should be today
      const today = new Date();
      expect(startDate.getFullYear()).toBe(today.getFullYear());
      expect(startDate.getMonth()).toBe(today.getMonth());
      expect(startDate.getDate()).toBe(today.getDate());
      expect(endDate.getDate()).toBe(today.getDate());

      // Start should be midnight, end should be end-of-day
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
    });

    it('should return a 7-day window for period "week"', () => {
      const { startDate, endDate } = getDateRange('week');
      // Start should be 6 days before today at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expectedStart = new Date(today);
      expectedStart.setDate(expectedStart.getDate() - 6);
      expect(startDate.getDate()).toBe(expectedStart.getDate());
    });

    it('should return a 30-day window for period "month"', () => {
      const { startDate, endDate } = getDateRange('month');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expectedStart = new Date(today);
      expectedStart.setDate(expectedStart.getDate() - 29);
      expect(startDate.getDate()).toBe(expectedStart.getDate());
      expect(endDate.getHours()).toBe(23);
    });

    it('should default to "week" for an unknown period', () => {
      const weekResult = getDateRange('week');
      const unknownResult = getDateRange('unknown');
      // Both should produce the same start date as they default to 'week'
      expect(unknownResult.startDate.getDate()).toBe(weekResult.startDate.getDate());
    });
  });

  describe('getPreviousPeriodRange', () => {
    it('should return the previous day for a single-day window', () => {
      const { startDate, endDate } = getDateRange('day');
      const prev = getPreviousPeriodRange(startDate, endDate);

      // Previous period end should be the day before the current start
      expect(prev.endDate.getTime()).toBeLessThan(startDate.getTime());

      // Duration should match the current period (~1 day)
      const prevDuration = prev.endDate.getTime() - prev.startDate.getTime();
      const currDuration = endDate.getTime() - startDate.getTime();
      expect(Math.abs(prevDuration - currDuration)).toBeLessThan(2000);
    });

    it('should return the previous week for a week window', () => {
      const { startDate, endDate } = getDateRange('week');
      const prev = getPreviousPeriodRange(startDate, endDate);

      expect(prev.endDate.getTime()).toBeLessThan(startDate.getTime());
    });
  });

  describe('calcPercentageChange', () => {
    it('should return positive change', () => {
      expect(calcPercentageChange(110, 100)).toBe(10);
    });

    it('should return negative change', () => {
      expect(calcPercentageChange(90, 100)).toBe(-10);
    });

    it('should return 0 when previous is 0', () => {
      expect(calcPercentageChange(50, 0)).toBe(0);
    });

    it('should return 0 when both values are 0', () => {
      expect(calcPercentageChange(0, 0)).toBe(0);
    });

    it('should round to one decimal place', () => {
      // (15 - 10) / 10 = 50%
      expect(calcPercentageChange(15, 10)).toBe(50);
      // (7 - 6) / 6 = 16.666... → 16.7
      expect(calcPercentageChange(7, 6)).toBe(16.7);
    });
  });

  describe('phase constants', () => {
    it('BOOKED_PHASES should include booked and confirmed', () => {
      expect(BOOKED_PHASES).toContain('booked');
      expect(BOOKED_PHASES).toContain('confirmed');
    });

    it('QUALIFIED_PHASES should include qualified and later stages', () => {
      expect(QUALIFIED_PHASES).toContain('qualified');
      expect(QUALIFIED_PHASES).toContain('booking');
    });
  });
});
