/**
 * Tests for ClinicSettingsForm.
 *
 * Verifies that the editable settings form pre-fills fields from the clinic
 * prop, reflects user edits in the draft, manages service area chips, and
 * calls onSave with the correct updated clinic data on submit.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClinicSettingsForm from '@/components/EditClinicsDetails/ClinicSettingsForm';
import type { Clinic } from '@/components/EditClinicsDetails/types';

jest.mock('@/components/EditClinicsDetails/BusinessHoursEditor', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (h: unknown[]) => void }) => (
    <div data-testid="business-hours-editor">
      <button type="button" onClick={() => onChange([{ day: 'monday', isOpen: true, openTime: '08:00', closeTime: '16:00' }])}>
        Update Hours
      </button>
    </div>
  ),
}));

const baseClinic: Clinic = {
  _id: 'abc123',
  name: 'Cardiff Physio',
  address: '1 High Street, Cardiff',
  phone: '029 2034 5678',
  ghlLocationId: 'loc_cardiff_001',
  isActive: true,
  serviceAreas: [{ postcodePrefix: 'CF' }, { postcodePrefix: 'NP' }],
  businessHours: [{ day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' }],
  monthLeadsCount: 10,
  monthBookingsCount: 5,
};

function renderForm(onSave = jest.fn()) {
  const ref = React.createRef<HTMLFormElement>();
  render(<ClinicSettingsForm ref={ref} clinic={baseClinic} onSave={onSave} />);
  return { ref, onSave };
}

describe('ClinicSettingsForm', () => {
  it('pre-fills the clinic name field', () => {
    renderForm();
    expect((screen.getByLabelText('Clinic Name') as HTMLInputElement).value).toBe('Cardiff Physio');
  });

  it('pre-fills the address field', () => {
    renderForm();
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('1 High Street, Cardiff');
  });

  it('pre-fills the phone field', () => {
    renderForm();
    expect((screen.getByLabelText('Phone Number') as HTMLInputElement).value).toBe('029 2034 5678');
  });

  it('pre-fills the GHL location ID field', () => {
    renderForm();
    expect((screen.getByLabelText('GHL Location ID') as HTMLInputElement).value).toBe('loc_cardiff_001');
  });

  it('updates the clinic name when the user types', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Clinic Name'), { target: { value: 'New Name' } });
    expect((screen.getByLabelText('Clinic Name') as HTMLInputElement).value).toBe('New Name');
  });

  it('updates the address when the user types', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '2 New St' } });
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('2 New St');
  });

  it('updates the phone when the user types', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '020 1234 5678' } });
    expect((screen.getByLabelText('Phone Number') as HTMLInputElement).value).toBe('020 1234 5678');
  });

  it('renders existing service area chips', () => {
    renderForm();
    expect(screen.getByText('CF')).toBeTruthy();
    expect(screen.getByText('NP')).toBeTruthy();
  });

  it('adds a new service area chip', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Add postcode prefix (e.g. BA)'), { target: { value: 'ba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(screen.getByText('BA')).toBeTruthy();
  });

  it('normalises the postcode prefix to uppercase', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Add postcode prefix (e.g. BA)'), { target: { value: 'sw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(screen.getByText('SW')).toBeTruthy();
  });

  it('clears the input after adding a service area', () => {
    renderForm();
    const input = screen.getByPlaceholderText('Add postcode prefix (e.g. BA)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'SA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(input.value).toBe('');
  });

  it('does not add a duplicate service area', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Add postcode prefix (e.g. BA)'), { target: { value: 'CF' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(screen.getAllByText('CF').length).toBe(1);
  });

  it('does not add an empty service area', () => {
    renderForm();
    const chipsBefore = screen.getAllByText(/^[A-Z]{2}$/).length;
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(screen.getAllByText(/^[A-Z]{2}$/).length).toBe(chipsBefore);
  });

  it('removes a service area chip when × is clicked', () => {
    renderForm();
    const removeButtons = screen.getAllByRole('button', { name: '×' });
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText('CF')).toBeNull();
  });

  it('calls onSave with updated clinic data when the form is submitted', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderForm(onSave);
    fireEvent.change(screen.getByLabelText('Clinic Name'), { target: { value: 'Updated Name' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave.mock.calls[0][0].name).toBe('Updated Name');
    });
  });

  it('passes updated service areas in the onSave payload', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderForm(onSave);
    fireEvent.change(screen.getByPlaceholderText('Add postcode prefix (e.g. BA)'), { target: { value: 'SW' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => {
      const savedClinic = onSave.mock.calls[0][0] as Clinic;
      expect(savedClinic.serviceAreas.map((s) => s.postcodePrefix)).toContain('SW');
    });
  });

  it('renders the BusinessHoursEditor', () => {
    renderForm();
    expect(screen.getByTestId('business-hours-editor')).toBeTruthy();
  });

  it('passes updated business hours in the onSave payload', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderForm(onSave);
    fireEvent.click(screen.getByRole('button', { name: 'Update Hours' }));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => {
      const savedClinic = onSave.mock.calls[0][0] as Clinic;
      expect(savedClinic.businessHours[0].openTime).toBe('08:00');
    });
  });
});
