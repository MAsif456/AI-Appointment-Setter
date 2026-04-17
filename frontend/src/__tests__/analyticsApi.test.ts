/**
 * Unit tests for the analytics API client functions.
 * Mocks global fetch to verify URL construction and error handling.
 */

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import after setting up the mock
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchOverviewAnalytics, fetchClinicComparison, fetchClinicAnalytics } = require('@/lib/api/analytics');

const mockOverview = { totalLeads: 50, totalBookings: 20, conversionRate: 40 };
const mockComparison = [{ clinicId: 'c1', clinicName: 'Test Clinic' }];
const mockClinicData = { leads: 30, bookings: 12 };

describe('Analytics API', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('fetchOverviewAnalytics', () => {
    it('should call the overview endpoint without params', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockOverview) });

      const result = await fetchOverviewAnalytics();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/analytics/overview'),
        expect.any(Object),
      );
      expect(result).toEqual(mockOverview);
    });

    it('should include period query param', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockOverview) });

      await fetchOverviewAnalytics({ period: 'month' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('period=month'),
        expect.any(Object),
      );
    });

    it('should include custom date range params', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockOverview) });

      await fetchOverviewAnalytics({ startDate: '2026-03-01', endDate: '2026-03-15' });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('startDate=2026-03-01');
      expect(url).toContain('endDate=2026-03-15');
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false, status: 500, statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      await expect(fetchOverviewAnalytics()).rejects.toThrow('Server error');
    });
  });

  describe('fetchClinicComparison', () => {
    it('should call the clinics comparison endpoint', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockComparison) });

      const result = await fetchClinicComparison();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/analytics/clinics'),
        expect.any(Object),
      );
      expect(result).toEqual(mockComparison);
    });
  });

  describe('fetchClinicAnalytics', () => {
    it('should call the clinic-specific endpoint', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockClinicData) });

      const result = await fetchClinicAnalytics('abc123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/analytics/clinics/abc123'),
        expect.any(Object),
      );
      expect(result).toEqual(mockClinicData);
    });

    it('should include date range params for clinic analytics', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockClinicData) });

      await fetchClinicAnalytics('abc123', { startDate: '2026-03-01', endDate: '2026-03-15' });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('startDate=2026-03-01');
      expect(url).toContain('endDate=2026-03-15');
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false, status: 404, statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Clinic not found' }),
      });

      await expect(fetchClinicAnalytics('bad-id')).rejects.toThrow('Clinic not found');
    });
  });
});
