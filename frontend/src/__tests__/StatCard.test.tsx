/**
 * Unit tests for the StatCard component.
 * Verifies rendering of title, value, suffix, trend icons, and clock icon.
 */
import { render, screen } from '@testing-library/react';
import StatCard from '@/components/Analytics/StatCard';

describe('StatCard', () => {
  it('should render the title and value', () => {
    render(<StatCard title="Total Leads" value={557} />);

    expect(screen.getByText('Total Leads')).toBeInTheDocument();
    expect(screen.getByText(/557/)).toBeInTheDocument();
  });

  it('should render a string value with suffix', () => {
    render(<StatCard title="Response Time" value="8" suffix=" sec" />);

    expect(screen.getByText('Response Time')).toBeInTheDocument();
    expect(screen.getByText(/8/)).toBeInTheDocument();
    expect(screen.getByText('sec')).toBeInTheDocument();
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

  it('should not show any icon when change is undefined and no icon prop', () => {
    const { container } = render(<StatCard title="Leads" value={100} />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  it('should show clock icon when icon prop is set to clock', () => {
    const { container } = render(<StatCard title="Response Time" value="8 sec" icon="clock" />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // Clock icon has a circle element
    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();
  });
});
