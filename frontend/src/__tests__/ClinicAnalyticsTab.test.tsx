/**
 * Unit tests for the ClinicAnalyticsTab component.
 * Verifies loading state, data rendering, and error handling.
 */
import { render, screen, waitFor } from '@testing-library/react';
import ClinicAnalyticsTab from '@/components/Analytics/ClinicAnalyticsTab';

// Mock the analytics API module
jest.mock('@/lib/api/analytics', () => ({
  fetchClinicAnalytics: jest.fn(),
}));

// Mock recharts components to avoid SSR/canvas issues in jsdom
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchClinicAnalytics } = require('@/lib/api/analytics');

const mockData = {
  leads: 245,
  bookings: 103,
  conversionRate: 42,
  bookingsOverTime: [{ date: '2026-03-20', count: 5 }],
  funnel: { leads: 245, qualified: 200, bookingStarted: 150, booked: 103 },
  conversationPhaseDistribution: [
    { phase: 'confirmed', count: 2 },
    { phase: 'booking', count: 1 },
  ],
  leadSources: [
    { source: 'facebook', count: 1, percentage: 33 },
    { source: 'website', count: 1, percentage: 33 },
  ],
  avgMessagesToBooking: 8,
  declineRate: 8,
};

describe('ClinicAnalyticsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    fetchClinicAnalytics.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<ClinicAnalyticsTab clinicId="abc123" />);

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('should render stat cards after data loads', async () => {
    fetchClinicAnalytics.mockResolvedValue(mockData);

    render(<ClinicAnalyticsTab clinicId="abc123" />);

    await waitFor(() => {
      expect(screen.getByText('Leads (7 days)')).toBeInTheDocument();
    });

    expect(screen.getByText('Bookings (7 days)')).toBeInTheDocument();
    expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Messages to Booking')).toBeInTheDocument();
  });

  it('should render phase distribution section', async () => {
    fetchClinicAnalytics.mockResolvedValue(mockData);

    render(<ClinicAnalyticsTab clinicId="abc123" />);

    await waitFor(() => {
      expect(screen.getByText('Conversation Phase Distribution')).toBeInTheDocument();
    });
  });

  it('should render lead sources section', async () => {
    fetchClinicAnalytics.mockResolvedValue(mockData);

    render(<ClinicAnalyticsTab clinicId="abc123" />);

    await waitFor(() => {
      expect(screen.getByText('Lead Sources')).toBeInTheDocument();
    });
  });

  it('should show error message on API failure', async () => {
    fetchClinicAnalytics.mockRejectedValue(new Error('Network error'));

    render(<ClinicAnalyticsTab clinicId="abc123" />);

    await waitFor(() => {
      expect(screen.getByText('Error: Network error')).toBeInTheDocument();
    });
  });

  it('should call fetchClinicAnalytics with the correct clinicId', async () => {
    fetchClinicAnalytics.mockResolvedValue(mockData);

    render(<ClinicAnalyticsTab clinicId="507f1f77bcf86cd799439011" />);

    await waitFor(() => {
      expect(fetchClinicAnalytics).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }),
      );
    });
  });
});
