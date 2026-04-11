/**
 * Unit tests for the FunnelChart component.
 * Verifies funnel stage rendering with mocked Recharts components.
 */
import { render, screen } from '@testing-library/react';
import FunnelChart from '@/components/Analytics/FunnelChart';

// Mock recharts components to avoid jsdom rendering issues
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

describe('FunnelChart', () => {
  const mockFunnel = {
    leads: 100,
    qualified: 80,
    bookingStarted: 60,
    booked: 45,
  };

  it('should render the title', () => {
    render(<FunnelChart funnel={mockFunnel} />);

    expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
  });

  it('should render the chart container', () => {
    render(<FunnelChart funnel={mockFunnel} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should handle zero values without errors', () => {
    const zeroFunnel = { leads: 0, qualified: 0, bookingStarted: 0, booked: 0 };

    render(<FunnelChart funnel={zeroFunnel} />);

    expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should render with large values', () => {
    const largeFunnel = { leads: 1000, qualified: 750, bookingStarted: 500, booked: 300 };

    render(<FunnelChart funnel={largeFunnel} />);

    expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
  });
});
