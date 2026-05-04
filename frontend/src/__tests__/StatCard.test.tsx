/**
 * Unit tests for the StatCard component.
 * Verifies rendering of title, value, suffix, trend icons, and the
 * delta label ("vs yesterday") added for the staff dashboard.
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

  // Delta label tests — added for the dashboard stat cards
  it('should render the delta label with positive change', () => {
    render(<StatCard title="Leads" value={35} change={12} changeLabel="vs yesterday" />);

    const delta = screen.getByLabelText('+12% vs yesterday');
    expect(delta).toBeInTheDocument();
    expect(delta).toHaveTextContent('+12%');
    expect(delta).toHaveTextContent('vs yesterday');
  });

  it('should render the delta label with negative change', () => {
    render(<StatCard title="Leads" value={20} change={-8.5} changeLabel="vs yesterday" />);

    const delta = screen.getByLabelText('-8.5% vs yesterday');
    expect(delta).toBeInTheDocument();
    expect(delta).toHaveTextContent('-8.5%');
  });

  it('should render a flat delta when change is zero with a label', () => {
    render(<StatCard title="Leads" value={10} change={0} changeLabel="vs yesterday" />);

    const delta = screen.getByLabelText('0% vs yesterday');
    expect(delta).toBeInTheDocument();
    expect(delta).toHaveTextContent('0%');
  });

  it('should not render the delta row when changeLabel is absent', () => {
    render(<StatCard title="Leads" value={10} change={5} />);

    expect(screen.queryByText('vs yesterday')).not.toBeInTheDocument();
  });

  it('should render a custom icon when provided', () => {
    const icon = <svg data-testid="custom-icon" />;
    render(<StatCard title="Messages" value={8} icon={icon} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('should hide the trend arrow when a custom icon is provided', () => {
    const icon = <svg data-testid="custom-icon" />;
    const { container } = render(
      <StatCard title="Messages" value={8} change={5} icon={icon} />,
    );

    // The custom icon replaces the trend arrow — only one SVG expected
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
