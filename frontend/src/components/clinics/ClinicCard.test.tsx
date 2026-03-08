import { render, screen, fireEvent } from '@testing-library/react';
import ClinicCard from './ClinicCard';
import { Clinic } from '@/types/clinic';

// Mock next/link as a simple anchor
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

/** Factory for a sample active clinic. */
const makeClinic = (overrides: Partial<Clinic> = {}): Clinic => ({
  _id: '123',
  name: 'Cardiff Physiotherapy Centre',
  ghlLocationId: 'loc_cardiff_001',
  ghlCalendarId: 'cal_cardiff_001',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  serviceAreas: [{ postcodePrefix: 'CF' }, { postcodePrefix: 'NP' }],
  todayLeadsCount: 12,
  todayBookingsCount: 5,
  monthLeadsCount: 245,
  monthBookingsCount: 103,
  defaultAppointmentDuration: 30,
  isActive: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

describe('ClinicCard', () => {
  const onToggleStatus = jest.fn();

  afterEach(() => jest.clearAllMocks());

  it('renders clinic name, address, and stats', () => {
    render(<ClinicCard clinic={makeClinic()} onToggleStatus={onToggleStatus} />);

    expect(screen.getByText('Cardiff Physiotherapy Centre')).toBeInTheDocument();
    expect(screen.getByText('123 Queen Street, Cardiff, CF10 2BX')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders service area tags', () => {
    render(<ClinicCard clinic={makeClinic()} onToggleStatus={onToggleStatus} />);

    expect(screen.getByText('CF')).toBeInTheDocument();
    expect(screen.getByText('NP')).toBeInTheDocument();
  });

  it('shows "Active" badge for active clinics', () => {
    render(<ClinicCard clinic={makeClinic()} onToggleStatus={onToggleStatus} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows "Inactive" badge for inactive clinics', () => {
    render(<ClinicCard clinic={makeClinic({ isActive: false })} onToggleStatus={onToggleStatus} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders a "View details" link pointing to the clinic page', () => {
    render(<ClinicCard clinic={makeClinic()} onToggleStatus={onToggleStatus} />);
    const link = screen.getByText('View details →');
    expect(link.closest('a')).toHaveAttribute('href', '/clinics/123');
  });

  it('opens the dropdown menu when the three-dot button is clicked', () => {
    render(<ClinicCard clinic={makeClinic()} onToggleStatus={onToggleStatus} />);

    fireEvent.click(screen.getByLabelText('Clinic actions'));

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Deactivate Clinic')).toBeInTheDocument();
  });

  it('shows "Activate Clinic" in the menu for inactive clinics', () => {
    render(<ClinicCard clinic={makeClinic({ isActive: false })} onToggleStatus={onToggleStatus} />);

    fireEvent.click(screen.getByLabelText('Clinic actions'));

    expect(screen.getByText('Activate Clinic')).toBeInTheDocument();
  });

  it('calls onToggleStatus when deactivate is clicked', () => {
    render(<ClinicCard clinic={makeClinic()} onToggleStatus={onToggleStatus} />);

    fireEvent.click(screen.getByLabelText('Clinic actions'));
    fireEvent.click(screen.getByText('Deactivate Clinic'));

    expect(onToggleStatus).toHaveBeenCalledWith('123', false);
  });
});
