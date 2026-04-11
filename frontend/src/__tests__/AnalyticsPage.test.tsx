/**
 * Unit tests for the main AnalyticsPage.
 * Verifies loading state, data rendering, and date range interaction.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AnalyticsPage from '@/app/analytics/page';

// Mock the analytics API module
jest.mock('@/lib/api/analytics', () => ({
  fetchOverviewAnalytics: jest.fn(),
  fetchClinicComparison: jest.fn(),
}));

// Mock recharts components to avoid jsdom rendering issues
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchOverviewAnalytics, fetchClinicComparison } = require('@/lib/api/analytics');

const mockOverview = {
  totalLeads: 557,
  totalBookings: 250,
  conversionRate: 45,
  avgResponseTime: 8,
  comparison: { leadsChange: 5, bookingsChange: 10, conversionRateChange: -2, avgResponseTimeChange: -1 },
  bookingsOverTime: [{ date: '2026-03-20', count: 12 }],
  conversionFunnel: { leads: 557, qualified: 400, bookingStarted: 300, booked: 250 },
};

const mockClinics = [
  { clinicId: 'c1', clinicName: 'Cardiff Physio', leads: 245, bookings: 103, conversionRate: 42, avgMessages: 8, declineRate: 8 },
];

describe('AnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    fetchOverviewAnalytics.mockReturnValue(new Promise(() => {}));
    fetchClinicComparison.mockReturnValue(new Promise(() => {}));

    render(<AnalyticsPage />);

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('should render the page title and stat cards after loading', async () => {
    fetchOverviewAnalytics.mockResolvedValue(mockOverview);
    fetchClinicComparison.mockResolvedValue(mockClinics);

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Leads')).toBeInTheDocument();
    expect(screen.getByText('Total Bookings')).toBeInTheDocument();
    expect(screen.getByText('Overall Conversion Rate')).toBeInTheDocument();
    expect(screen.getByText('Average Response Time')).toBeInTheDocument();
  });

  it('should render the conversion funnel', async () => {
    fetchOverviewAnalytics.mockResolvedValue(mockOverview);
    fetchClinicComparison.mockResolvedValue(mockClinics);

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
    });
  });

  it('should render the clinic comparison table', async () => {
    fetchOverviewAnalytics.mockResolvedValue(mockOverview);
    fetchClinicComparison.mockResolvedValue(mockClinics);

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Clinic Comparison')).toBeInTheDocument();
    });

    expect(screen.getByText('Cardiff Physio')).toBeInTheDocument();
  });

  it('should render the date range selector', async () => {
    fetchOverviewAnalytics.mockResolvedValue(mockOverview);
    fetchClinicComparison.mockResolvedValue(mockClinics);

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select date range')).toBeInTheDocument();
    });
  });

  it('should refetch data when date range changes to Last 30 days', async () => {
    fetchOverviewAnalytics.mockResolvedValue(mockOverview);
    fetchClinicComparison.mockResolvedValue(mockClinics);

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    // Change to Last 30 days
    fireEvent.change(screen.getByLabelText('Select date range'), {
      target: { value: 'Last 30 days' },
    });

    // Should have been called again with 'month' period
    await waitFor(() => {
      expect(fetchOverviewAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'month' }),
      );
    });
  });
});
