/**
 * Unit tests for the StatCard component.
 * Verifies rendering of title, value, suffix, and trend icons.
 */
import { render, screen } from '@testing-library/react';
import StatCard from '@/components/Analytics/StatCard';

describe('StatCard', () => {
  it('should render the title and value', () => {
    render(<StatCard title="Total Leads" value={557} />);

    expect(screen.getByText('Total Leads')).toBeInTheDocument();
    expect(screen.getByText(/557/)).toBeInTheDocument();
  });

  it('should render a numeric value with suffix', () => {
    render(<StatCard title="Conversion" value="45" suffix="%" />);

    expect(screen.getByText('Conversion')).toBeInTheDocument();
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('should render percentage value', () => {
    render(<StatCard title="Conversion Rate" value="45%" />);

    expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('should show SVG icon for positive change', () => {
    const { container } = render(<StatCard title="Leads" value={100} change={10} />);

    // SVG icon is rendered for trend indication
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show SVG icon for negative change', () => {
    const { container } = render(<StatCard title="Leads" value={100} change={-5} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should not show any icon when change is zero', () => {
    const { container } = render(<StatCard title="Leads" value={100} change={0} />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  it('should not show any icon when change is undefined', () => {
    const { container } = render(<StatCard title="Leads" value={100} />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });
});
