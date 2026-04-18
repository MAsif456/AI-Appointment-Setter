/**
 * Unit tests for the ClinicTable component.
 * Verifies table rendering, column headers, and empty state handling.
 */
import { render, screen } from '@testing-library/react';
import ClinicTable from '@/components/Analytics/ClinicTable';

describe('ClinicTable', () => {
  const mockClinics = [
    {
      clinicId: 'clinic1',
      clinicName: 'Cardiff Physiotherapy Centre',
      leads: 245,
      bookings: 103,
      conversionRate: 42,
      avgMessages: 8,
      declineRate: 8,
    },
    {
      clinicId: 'clinic2',
      clinicName: 'Swansea Wellness Hub',
      leads: 312,
      bookings: 147,
      conversionRate: 47,
      avgMessages: 7,
      declineRate: 6,
    },
  ];

  it('should render the title', () => {
    render(<ClinicTable clinics={mockClinics} />);

    expect(screen.getByText('Clinic Comparison')).toBeInTheDocument();
  });

  it('should render all column headers', () => {
    render(<ClinicTable clinics={mockClinics} />);

    expect(screen.getByText('Clinic Name')).toBeInTheDocument();
    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Messages')).toBeInTheDocument();
    expect(screen.getByText('Decline Rate')).toBeInTheDocument();
  });

  it('should render all clinic rows', () => {
    render(<ClinicTable clinics={mockClinics} />);

    expect(screen.getByText('Cardiff Physiotherapy Centre')).toBeInTheDocument();
    expect(screen.getByText('Swansea Wellness Hub')).toBeInTheDocument();
    expect(screen.getByText('245')).toBeInTheDocument();
    expect(screen.getByText('312')).toBeInTheDocument();
  });

  it('should display conversion rate with percentage sign', () => {
    render(<ClinicTable clinics={mockClinics} />);

    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('47%')).toBeInTheDocument();
  });

  it('should show empty state when no clinics provided', () => {
    render(<ClinicTable clinics={[]} />);

    expect(screen.getByText('No clinic data available.')).toBeInTheDocument();
  });
});
