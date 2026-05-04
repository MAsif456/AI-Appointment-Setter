/**
 * Tests for ClinicSettingsView.
 *
 * Verifies the read-only settings tab renders all clinic fields, shows dash
 * fallbacks for missing values, displays business hours in correct open/closed
 * state, shows the active/inactive status badge, and renders the Services &
 * Locations section with service and area pills.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ClinicSettingsView from '@/components/EditClinicsDetails/ClinicSettingsView';
import type { Clinic } from '@/types/clinic';

const baseClinic: Clinic = {
  _id: 'abc123',
  name: 'Cardiff Physio',
  address: '1 High Street, Cardiff',
  phone: '029 2034 5678',
  ghlLocationId: 'loc_cardiff_001',
  ghlCalendarId: 'cal_cardiff_001',
  isActive: true,
  serviceAreas: [{ postcodePrefix: 'CF' }, { postcodePrefix: 'NP' }],
  services: [{ name: 'Back pain' }, { name: 'Sports injury' }],
  businessHours: [
    { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'tuesday', isOpen: false },
    { day: 'saturday', isOpen: true, openTime: '10:00', closeTime: '14:00' },
  ],
  todayLeadsCount: 3,
  todayBookingsCount: 1,
  monthLeadsCount: 10,
  monthBookingsCount: 5,
  defaultAppointmentDuration: 30,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
};

describe('ClinicSettingsView', () => {
  it('renders the clinic name', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('Cardiff Physio')).toBeTruthy();
  });

  it('renders the address', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('1 High Street, Cardiff')).toBeTruthy();
  });

  it('renders the phone number', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('029 2034 5678')).toBeTruthy();
  });

  it('renders the GHL location ID', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('loc_cardiff_001')).toBeTruthy();
  });

  it('shows dash fallback when address is missing', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, address: undefined }} onEdit={() => {}} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows dash fallback when phone is missing', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, phone: undefined }} onEdit={() => {}} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows dash fallback when GHL location ID is missing', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, ghlLocationId: '' }} onEdit={() => {}} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows open hours for an open day', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('17:00')).toBeTruthy();
  });

  it('handles capitalised day keys from the API', () => {
    render(
      <ClinicSettingsView
        clinic={{
          ...baseClinic,
          businessHours: [
            { day: 'Monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          ],
        }}
        onEdit={() => {}}
      />
    );
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('17:00')).toBeTruthy();
  });

  it('shows Closed for a closed day', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getAllByText('Closed').length).toBeGreaterThan(0);
  });

  it('shows Closed for all seven days when businessHours is empty', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, businessHours: [] }} onEdit={() => {}} />);
    expect(screen.getAllByText('Closed').length).toBe(7);
  });

  it('shows Active badge and message when clinic is active', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('This clinic is currently accepting appointments')).toBeTruthy();
  });

  it('shows Inactive badge and message when clinic is not active', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, isActive: false }} onEdit={() => {}} />);
    expect(screen.getByText('Inactive')).toBeTruthy();
    expect(screen.getByText('This clinic is not currently accepting appointments')).toBeTruthy();
  });

  it('renders all seven day labels', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach((day) => {
      expect(screen.getByText(day)).toBeTruthy();
    });
  });

  it('renders open hours for Saturday when present', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('14:00')).toBeTruthy();
  });

  // ── Services & Locations section ──
  it('renders the Services & Locations section title', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('Services & Locations')).toBeTruthy();
  });

  it('renders service pills', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('Back pain')).toBeTruthy();
    expect(screen.getByText('Sports injury')).toBeTruthy();
  });

  it('renders service area pills', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText('CF')).toBeTruthy();
    expect(screen.getByText('NP')).toBeTruthy();
  });

  it('shows fallback when no services configured', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, services: [] }} onEdit={() => {}} />);
    expect(screen.getByText('No services configured')).toBeTruthy();
  });

  it('shows fallback when no service areas configured', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, serviceAreas: [] }} onEdit={() => {}} />);
    expect(screen.getByText('No service areas configured')).toBeTruthy();
  });

  it('shows postcode helper text', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} />);
    expect(screen.getByText(/These postcode prefixes determine/)).toBeTruthy();
  });

  it('shows data retention period', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, dataRetentionMonths: 24 }} onEdit={() => {}} />);
    expect(screen.getByText('24 months')).toBeTruthy();
  });

  it('shows success banner when saveSuccess is true', () => {
    render(<ClinicSettingsView clinic={baseClinic} onEdit={() => {}} saveSuccess />);
    expect(screen.getByText('Settings saved successfully.')).toBeTruthy();
  });
});
