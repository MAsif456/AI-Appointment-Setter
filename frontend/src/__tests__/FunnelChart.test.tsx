/**
 * Unit tests for the FunnelChart component.
 * Verifies funnel stage labels, bars, and accessibility attributes.
 */
import { render, screen } from '@testing-library/react';
import FunnelChart from '@/components/Analytics/FunnelChart';

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

  it('should render all four funnel stage labels', () => {
    render(<FunnelChart funnel={mockFunnel} />);

    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Booking Started')).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
  });

  it('should render stage values', () => {
    render(<FunnelChart funnel={mockFunnel} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('should render progress bars with correct aria attributes', () => {
    render(<FunnelChart funnel={mockFunnel} />);

    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(4);

    // Verify the first bar (Leads) has the correct aria-valuenow
    expect(bars[0]).toHaveAttribute('aria-valuenow', '100');
    expect(bars[0]).toHaveAttribute('aria-label', 'Leads: 100');
  });

  it('should handle zero values without errors', () => {
    const zeroFunnel = { leads: 0, qualified: 0, bookingStarted: 0, booked: 0 };

    render(<FunnelChart funnel={zeroFunnel} />);

    expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(4);
  });
});
