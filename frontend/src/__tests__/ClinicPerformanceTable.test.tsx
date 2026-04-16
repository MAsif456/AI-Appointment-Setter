/**
 * Unit tests for the ClinicPerformanceTable component.
 * Verifies rendering, row click navigation, status badges, keyboard
 * accessibility, and the empty-state fallback.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import ClinicPerformanceTable from '@/components/dashboard/ClinicPerformanceTable';
import type { ClinicComparisonRow } from '@/types/analytics';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockClinics: ClinicComparisonRow[] = [
  { clinicId: 'c1', clinicName: 'Cardiff Physio', leads: 12, bookings: 5, conversionRate: 42, avgMessages: 7, declineRate: 8 },
  { clinicId: 'c2', clinicName: 'Newport Sports', leads: 8, bookings: 3, conversionRate: 38, avgMessages: 6, declineRate: 10 },
];

describe('ClinicPerformanceTable', () => {
  beforeEach(() => mockPush.mockClear());

  it('should render the heading', () => {
    render(<ClinicPerformanceTable clinics={mockClinics} />);
    expect(screen.getByText('Clinic Performance')).toBeInTheDocument();
  });

  it('should render all clinic rows', () => {
    render(<ClinicPerformanceTable clinics={mockClinics} />);
    expect(screen.getByText('Cardiff Physio')).toBeInTheDocument();
    expect(screen.getByText('Newport Sports')).toBeInTheDocument();
  });

  it('should display correct column values for each row', () => {
    render(<ClinicPerformanceTable clinics={mockClinics} />);
    // Cardiff Physio row values
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('should navigate to clinic detail on row click', () => {
    render(<ClinicPerformanceTable clinics={mockClinics} />);
    fireEvent.click(screen.getByText('Cardiff Physio'));
    expect(mockPush).toHaveBeenCalledWith('/clinics/c1');
  });

  it('should navigate on Enter key press', () => {
    render(<ClinicPerformanceTable clinics={mockClinics} />);
    const row = screen.getByLabelText('View details for Cardiff Physio');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/clinics/c1');
  });

  it('should show Active status badge by default', () => {
    render(<ClinicPerformanceTable clinics={mockClinics} />);
    const badges = screen.getAllByText('Active');
    expect(badges.length).toBe(2);
  });

  it('should show Inactive badge when activeById marks a clinic inactive', () => {
    render(
      <ClinicPerformanceTable
        clinics={mockClinics}
        activeById={{ c1: true, c2: false }}
      />,
    );
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBe(1);
  });

  it('should render empty state when clinics array is empty', () => {
    render(<ClinicPerformanceTable clinics={[]} />);
    expect(screen.getByText('No clinic data available yet.')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(<ClinicPerformanceTable clinics={mockClinics} />);
    expect(screen.getByText('Clinic Name')).toBeInTheDocument();
    expect(screen.getByText("Today's Leads")).toBeInTheDocument();
    expect(screen.getByText("Today's Bookings")).toBeInTheDocument();
    expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });
});
