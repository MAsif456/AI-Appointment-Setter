/**
 * Unit tests for the LeadSources component.
 * Verifies source bars render correctly with names, counts, and percentages.
 */
import { render, screen } from '@testing-library/react';
import LeadSources from '@/components/Analytics/LeadSources';

describe('LeadSources', () => {
  const mockSources = [
    { source: 'facebook', count: 15, percentage: 50 },
    { source: 'google_ads', count: 10, percentage: 33 },
    { source: 'website', count: 5, percentage: 17 },
  ];

  it('should render the title', () => {
    render(<LeadSources sources={mockSources} />);

    expect(screen.getByText('Lead Sources')).toBeInTheDocument();
  });

  it('should render formatted source names', () => {
    render(<LeadSources sources={mockSources} />);

    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('Website')).toBeInTheDocument();
  });

  it('should display count and percentage for each source', () => {
    render(<LeadSources sources={mockSources} />);

    expect(screen.getByText('15 (50%)')).toBeInTheDocument();
    expect(screen.getByText('10 (33%)')).toBeInTheDocument();
    expect(screen.getByText('5 (17%)')).toBeInTheDocument();
  });

  it('should render progress bars with correct aria attributes', () => {
    render(<LeadSources sources={mockSources} />);

    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '50');
    expect(bars[0]).toHaveAttribute('aria-label', 'Facebook: 50%');
  });

  it('should show empty state when no sources provided', () => {
    render(<LeadSources sources={[]} />);

    expect(screen.getByText('No lead source data available.')).toBeInTheDocument();
  });
});
