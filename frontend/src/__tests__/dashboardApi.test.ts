/**
 * Unit tests for the dashboard API helper functions.
 * Verifies that each wrapper calls the correct underlying endpoint
 * and handles filtering/sorting of conversations properly.
 */
import {
  fetchDashboardOverview,
  fetchDashboardClinics,
  fetchRecentConversations,
} from '@/lib/api/dashboard';

jest.mock('@/lib/api/analytics', () => ({
  fetchOverviewAnalytics: jest.fn(),
  fetchClinicComparison: jest.fn(),
}));

jest.mock('@/lib/apiAxios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchOverviewAnalytics, fetchClinicComparison } = require('@/lib/api/analytics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('@/lib/apiAxios').default;

describe('dashboard API helpers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchDashboardOverview', () => {
    it('should call fetchOverviewAnalytics with period "day"', async () => {
      fetchOverviewAnalytics.mockResolvedValue({ totalLeads: 10 });
      const result = await fetchDashboardOverview();

      expect(fetchOverviewAnalytics).toHaveBeenCalledWith({ period: 'day' });
      expect(result).toEqual({ totalLeads: 10 });
    });
  });

  describe('fetchDashboardClinics', () => {
    it('should call fetchClinicComparison with period "day"', async () => {
      fetchClinicComparison.mockResolvedValue([{ clinicId: 'c1' }]);
      const result = await fetchDashboardClinics();

      expect(fetchClinicComparison).toHaveBeenCalledWith({ period: 'day' });
      expect(result).toEqual([{ clinicId: 'c1' }]);
    });
  });

  describe('fetchRecentConversations', () => {
    const conversations = [
      { _id: 'a', lastMessageAt: '2026-03-15T10:00:00Z', clinicId: { _id: 'c1', name: 'A' }, leadId: null },
      { _id: 'b', lastMessageAt: '2026-03-16T10:00:00Z', clinicId: { _id: 'c2', name: 'B' }, leadId: null },
      { _id: 'c', lastMessageAt: '2026-03-14T10:00:00Z', clinicId: { _id: 'c1', name: 'A' }, leadId: null },
    ];

    it('should return the N most recent conversations sorted by lastMessageAt', async () => {
      api.get.mockResolvedValue({ data: conversations });

      const result = await fetchRecentConversations(2);

      expect(result.length).toBe(2);
      // Most recent first
      expect(result[0]._id).toBe('b');
      expect(result[1]._id).toBe('a');
    });

    it('should return all conversations when limit exceeds count', async () => {
      api.get.mockResolvedValue({ data: conversations });
      const result = await fetchRecentConversations(10);
      expect(result.length).toBe(3);
    });

    it('should filter by clinicId when provided', async () => {
      api.get.mockResolvedValue({ data: conversations });

      const result = await fetchRecentConversations(5, 'c1');

      expect(result.every((c: any) => c.clinicId._id === 'c1')).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should handle conversations with null lastMessageAt', async () => {
      api.get.mockResolvedValue({
        data: [
          { _id: 'x', lastMessageAt: null, createdAt: '2026-01-01T00:00:00Z', clinicId: null, leadId: null },
          { _id: 'y', lastMessageAt: '2026-03-16T10:00:00Z', clinicId: null, leadId: null },
        ],
      });

      const result = await fetchRecentConversations(5);

      // The one with lastMessageAt should sort first
      expect(result[0]._id).toBe('y');
    });

    it('should return empty array when API returns no conversations', async () => {
      api.get.mockResolvedValue({ data: [] });
      const result = await fetchRecentConversations(5);
      expect(result).toEqual([]);
    });
  });
});
