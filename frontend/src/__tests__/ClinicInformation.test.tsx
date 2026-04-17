/**
 * Unit tests for the ClinicInformation component.
 * Verifies rendering of address, phone, service areas, services
 * offered, business hours, and the fallback states when data is absent.
 */
import { render, screen } from '@testing-library/react';
import ClinicInformation from '@/components/clinics/ClinicInformation';
import type { Clinic } from '@/types/clinic';

const fullClinic: Clinic = {
  _id: 'c1',
  name: 'Cardiff Physiotherapy Centre',
  ghlLocationId: 'loc_001',
  ghlCalendarId: 'cal_001',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  phone: '029 2034 5678',
  serviceAreas: [
    { postcodePrefix: 'CF' },
    { postcodePrefix: 'NP' },
    { postcodePrefix: 'SA' },
  ],
  services: [
    { name: 'Back pain', durationMinutes: 30 },
    { name: 'Sports injury', durationMinutes: 45 },
  ],
  businessHours: [
    { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'tuesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'wednesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'thursday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'friday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'saturday', isOpen: true, openTime: '10:00', closeTime: '14:00' },
    { day: 'sunday', isOpen: false },
  ],
  todayLeadsCount: 0,
  todayBookingsCount: 0,
  monthLeadsCount: 0,
  monthBookingsCount: 0,
  isActive: true,
  defaultAppointmentDuration: 30,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

describe('ClinicInformation', () => {
  it('should render the section heading', () => {
    render(<ClinicInformation clinic={fullClinic} />);
    expect(screen.getByText('Clinic Information')).toBeInTheDocument();
  });

  it('should render address and phone', () => {
    render(<ClinicInformation clinic={fullClinic} />);
    expect(screen.getByText('123 Queen Street, Cardiff, CF10 2BX')).toBeInTheDocument();
    expect(screen.getByText('029 2034 5678')).toBeInTheDocument();
  });

  it('should render service area pills', () => {
    render(<ClinicInformation clinic={fullClinic} />);
    expect(screen.getByText('CF')).toBeInTheDocument();
    expect(screen.getByText('NP')).toBeInTheDocument();
    expect(screen.getByText('SA')).toBeInTheDocument();
  });

  it('should render services offered pills', () => {
    render(<ClinicInformation clinic={fullClinic} />);
    expect(screen.getByText('Back pain')).toBeInTheDocument();
    expect(screen.getByText('Sports injury')).toBeInTheDocument();
  });

  it('should render business hours for all days', () => {
    render(<ClinicInformation clinic={fullClinic} />);
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
  });

  it('should show "Closed" for days the clinic is not open', () => {
    render(<ClinicInformation clinic={fullClinic} />);
    // Sunday is closed
    const closedElements = screen.getAllByText('Closed');
    expect(closedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show open/close times for active days', () => {
    render(<ClinicInformation clinic={fullClinic} />);
    // Saturday has different hours
    expect(screen.getByText('10:00 - 14:00')).toBeInTheDocument();
  });

  it('should show dash when address is missing', () => {
    const noAddress = { ...fullClinic, address: undefined };
    render(<ClinicInformation clinic={noAddress as Clinic} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('should show dash when phone is missing', () => {
    const noPhone = { ...fullClinic, phone: undefined };
    render(<ClinicInformation clinic={noPhone as Clinic} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('should show fallback when no service areas configured', () => {
    const noAreas = { ...fullClinic, serviceAreas: [] };
    render(<ClinicInformation clinic={noAreas} />);
    expect(screen.getByText('No service areas configured')).toBeInTheDocument();
  });

  it('should show fallback when no services configured', () => {
    const noServices = { ...fullClinic, services: [] };
    render(<ClinicInformation clinic={noServices} />);
    expect(screen.getByText('No services configured')).toBeInTheDocument();
  });

  it('should handle undefined services gracefully', () => {
    const noServices = { ...fullClinic, services: undefined };
    render(<ClinicInformation clinic={noServices} />);
    expect(screen.getByText('No services configured')).toBeInTheDocument();
  });

  it('should handle empty business hours array', () => {
    const noHours = { ...fullClinic, businessHours: [] };
    render(<ClinicInformation clinic={noHours} />);
    // All days should show "Closed"
    const closedElements = screen.getAllByText('Closed');
    expect(closedElements.length).toBe(7);
  });
});
