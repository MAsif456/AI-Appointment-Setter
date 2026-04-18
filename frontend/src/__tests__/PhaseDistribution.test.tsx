/**
 * Unit tests for the PhaseDistribution component.
 * Verifies phase badges render correctly and empty state is handled.
 */
import { render, screen } from '@testing-library/react';
import PhaseDistribution from '@/components/Analytics/PhaseDistribution';

describe('PhaseDistribution', () => {
  const mockPhases = [
    { phase: 'confirmed', count: 2 },
    { phase: 'booking', count: 1 },
    { phase: 'declined', count: 3 },
  ];

  it('should render the title', () => {
    render(<PhaseDistribution phases={mockPhases} />);

    expect(screen.getByText('Conversation Phase Distribution')).toBeInTheDocument();
  });

  it('should render all phase badges with counts', () => {
    render(<PhaseDistribution phases={mockPhases} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should format phase names correctly', () => {
    render(<PhaseDistribution phases={mockPhases} />);

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Booking')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
  });

  it('should show empty state when no phases provided', () => {
    render(<PhaseDistribution phases={[]} />);

    expect(screen.getByText('No conversation data available.')).toBeInTheDocument();
  });
});
