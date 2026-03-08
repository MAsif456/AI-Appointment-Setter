/**
 * Tests for ClinicSettingsView.
 *
 * Verifies the read-only settings tab renders all clinic fields, shows dash
 * fallbacks for missing values, displays business hours in correct open/closed
 * state, and shows the active/inactive status badge.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ClinicSettingsView from '@/components/EditClinicsDetails/ClinicSettingsView';
import type { Clinic } from '@/components/EditClinicsDetails/types';

const baseClinic: Clinic = {
  _id: 'abc123',
  name: 'Cardiff Physio',
  address: '1 High Street, Cardiff',
  phone: '029 2034 5678',
  ghlLocationId: 'loc_cardiff_001',
  isActive: true,
  serviceAreas: [{ postcodePrefix: 'CF' }, { postcodePrefix: 'NP' }],
  businessHours: [
    { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'tuesday', isOpen: false },
    { day: 'saturday', isOpen: true, openTime: '10:00', closeTime: '14:00' },
  ],
  monthLeadsCount: 10,
  monthBookingsCount: 5,
};

describe('ClinicSettingsView', () => {
  it('renders the clinic name', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    expect(screen.getByText('Cardiff Physio')).toBeTruthy();
  });

  it('renders the address', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    expect(screen.getByText('1 High Street, Cardiff')).toBeTruthy();
  });

  it('renders the phone number', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    expect(screen.getByText('029 2034 5678')).toBeTruthy();
  });

  it('renders the GHL location ID', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    expect(screen.getByText('loc_cardiff_001')).toBeTruthy();
  });

  it('shows dash fallback when address is missing', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, address: undefined }} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows dash fallback when phone is missing', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, phone: undefined }} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows dash fallback when GHL location ID is missing', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, ghlLocationId: undefined }} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows open hours for an open day', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('17:00')).toBeTruthy();
  });

  it('shows Closed for a closed day', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    expect(screen.getAllByText('Closed').length).toBeGreaterThan(0);
  });

  it('shows Closed for all seven days when businessHours is empty', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, businessHours: [] }} />);
    expect(screen.getAllByText('Closed').length).toBe(7);
  });

  it('shows Active badge and message when clinic is active', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('This clinic is currently accepting appointments')).toBeTruthy();
  });

  it('shows Inactive badge and message when clinic is not active', () => {
    render(<ClinicSettingsView clinic={{ ...baseClinic, isActive: false }} />);
    expect(screen.getByText('Inactive')).toBeTruthy();
    expect(screen.getByText('This clinic is not currently accepting appointments')).toBeTruthy();
  });

  it('renders all seven day labels', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach((day) => {
      expect(screen.getByText(day)).toBeTruthy();
    });
  });

  it('renders open hours for Saturday when present', () => {
    render(<ClinicSettingsView clinic={baseClinic} />);
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('14:00')).toBeTruthy();
  });
});
