/**
 * Tests for ClinicSettingsForm.
 *
 * Verifies that the form pre-fills fields from the clinic prop, reflects user
 * edits, and calls onSave with the correct payload when submitted via the
 * imperative ref handle. Sub-components are mocked so tests stay focused on
 * form-level behaviour.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClinicSettingsForm from '@/components/EditClinicsDetails/ClinicSettingsForm';
import type { ClinicSettingsFormHandle } from '@/components/EditClinicsDetails/ClinicSettingsForm';
import type { Clinic } from '@/types/clinic';

jest.mock('@/components/clinics/BasicInfoSection', () => ({
  __esModule: true,
  default: ({ clinicName, address, phoneNumber, onChange }: any) => (
    <div>
      <input
        data-testid="clinic-name"
        value={clinicName}
        onChange={(e) => onChange('clinicName', e.target.value)}
      />
      <input
        data-testid="address"
        value={address}
        onChange={(e) => onChange('address', e.target.value)}
      />
      <input
        data-testid="phone"
        value={phoneNumber}
        onChange={(e) => onChange('phoneNumber', e.target.value)}
      />
    </div>
  ),
}));

jest.mock('@/components/clinics/GhlIntegrationSection', () => ({
  __esModule: true,
  default: ({ locationId, calendarId, onChange }: any) => (
    <div>
      <input
        data-testid="location-id"
        value={locationId}
        onChange={(e) => onChange('ghlLocationId', e.target.value)}
      />
      <input
        data-testid="calendar-id"
        value={calendarId}
        onChange={(e) => onChange('ghlCalendarId', e.target.value)}
      />
    </div>
  ),
}));

jest.mock('@/components/clinics/ServiceConfigSection', () => ({
  __esModule: true,
  default: ({ serviceAreas, onChange }: any) => (
    <input
      data-testid="service-areas"
      value={serviceAreas}
      onChange={(e) => onChange('serviceAreas', e.target.value)}
    />
  ),
}));

jest.mock('@/components/clinics/BusinessHoursSection', () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button
      type="button"
      onClick={() => onChange('Monday', 'start', '08:00')}
    >
      Update Hours
    </button>
  ),
}));

const baseClinic: Clinic = {
  _id: 'abc123',
  name: 'Cardiff Physio',
  address: '1 High Street, Cardiff',
  phone: '029 2034 5678',
  ghlLocationId: 'loc_cardiff_001',
  ghlCalendarId: 'cal_cardiff_002',
  isActive: true,
  serviceAreas: [{ postcodePrefix: 'CF' }, { postcodePrefix: 'NP' }],
  businessHours: [{ day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' }],
  defaultAppointmentDuration: 30,
  todayLeadsCount: 0,
  todayBookingsCount: 0,
  monthLeadsCount: 0,
  monthBookingsCount: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function renderForm(onSave = jest.fn().mockResolvedValue(undefined)) {
  const formRef = React.createRef<ClinicSettingsFormHandle>();
  render(
    <ClinicSettingsForm
      ref={formRef}
      clinic={baseClinic}
      onSave={onSave}
      onCancel={jest.fn()}
    />
  );
  return { formRef, onSave };
}

describe('ClinicSettingsForm', () => {
  afterEach(() => jest.clearAllMocks());

  it('pre-fills the clinic name field', () => {
    renderForm();
    expect((screen.getByTestId('clinic-name') as HTMLInputElement).value).toBe('Cardiff Physio');
  });

  it('pre-fills the address field', () => {
    renderForm();
    expect((screen.getByTestId('address') as HTMLInputElement).value).toBe('1 High Street, Cardiff');
  });

  it('pre-fills the phone field', () => {
    renderForm();
    expect((screen.getByTestId('phone') as HTMLInputElement).value).toBe('029 2034 5678');
  });

  it('pre-fills the GHL location ID field', () => {
    renderForm();
    expect((screen.getByTestId('location-id') as HTMLInputElement).value).toBe('loc_cardiff_001');
  });

  it('pre-fills the GHL calendar ID field', () => {
    renderForm();
    expect((screen.getByTestId('calendar-id') as HTMLInputElement).value).toBe('cal_cardiff_002');
  });

  it('calls onSave with updated clinic name when submitted', async () => {
    const { formRef, onSave } = renderForm();
    fireEvent.change(screen.getByTestId('clinic-name'), { target: { value: 'New Name' } });
    formRef.current?.submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].name).toBe('New Name');
  });

  it('calls onSave with updated address when submitted', async () => {
    const { formRef, onSave } = renderForm();
    fireEvent.change(screen.getByTestId('address'), { target: { value: '2 New Street' } });
    formRef.current?.submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].address).toBe('2 New Street');
  });

  it('calls onSave with updated phone when submitted', async () => {
    const { formRef, onSave } = renderForm();
    fireEvent.change(screen.getByTestId('phone'), { target: { value: '020 9999 0000' } });
    formRef.current?.submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].phone).toBe('020 9999 0000');
  });

  it('calls onSave with initial service areas when submitted', async () => {
    const { formRef, onSave } = renderForm();
    formRef.current?.submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const areas = onSave.mock.calls[0][0].serviceAreas.map((s: any) => s.postcodePrefix);
    expect(areas).toContain('CF');
    expect(areas).toContain('NP');
  });

  it('calls onSave with business hours payload when submitted', async () => {
    const { formRef, onSave } = renderForm();
    formRef.current?.submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].businessHours).toBeDefined();
    expect(Array.isArray(onSave.mock.calls[0][0].businessHours)).toBe(true);
  });

  it('renders the BusinessHoursSection', () => {
    renderForm();
    expect(screen.getByText('Update Hours')).toBeInTheDocument();
  });

  it('does not call onSave when clinic name is empty', async () => {
    const { formRef, onSave } = renderForm();
    fireEvent.change(screen.getByTestId('clinic-name'), { target: { value: '' } });
    formRef.current?.submit();
    await new Promise((r) => setTimeout(r, 50));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('displays a save error when onSave throws', async () => {
    const { formRef } = renderForm(
      jest.fn().mockRejectedValue(new Error('Server error'))
    );
    formRef.current?.submit();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });

  // AC-9: Required field validation for address, phone, and service areas
  it('does not call onSave when address is empty', async () => {
    const { formRef, onSave } = renderForm();
    fireEvent.change(screen.getByTestId('address'), { target: { value: '' } });
    formRef.current?.submit();
    await new Promise((r) => setTimeout(r, 50));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not call onSave when phone is empty', async () => {
    const { formRef, onSave } = renderForm();
    fireEvent.change(screen.getByTestId('phone'), { target: { value: '' } });
    formRef.current?.submit();
    await new Promise((r) => setTimeout(r, 50));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not call onSave when service areas is empty', async () => {
    const { formRef, onSave } = renderForm();
    fireEvent.change(screen.getByTestId('service-areas'), { target: { value: '' } });
    formRef.current?.submit();
    await new Promise((r) => setTimeout(r, 50));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not call onSave when multiple required fields are empty', async () => {
    const { formRef, onSave } = renderForm();
    fireEvent.change(screen.getByTestId('clinic-name'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('address'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('phone'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('service-areas'), { target: { value: '' } });
    formRef.current?.submit();
    await new Promise((r) => setTimeout(r, 50));
    expect(onSave).not.toHaveBeenCalled();
  });
});
