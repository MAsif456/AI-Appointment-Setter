/**
 * Component tests for the Add New Clinic page.
 *
 * Renders the full form, simulates user interactions, and asserts
 * on validation messages, API calls, and navigation behaviour.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/clinics/new',
}));

const mockCreateClinic = jest.fn();
jest.mock('@/services/clinicService', () => ({
  createClinic: (...args: unknown[]) => mockCreateClinic(...args),
}));

import AddClinicPage from '@/app/clinics/new/page';

/**
 * Returns an HTMLInputElement with the given data-field attribute.
 *
 * @param {string} name - The value of the data-field attribute to search for.
 * @returns {HTMLInputElement} - The element with the matching data-field attribute, or null if not found.
 */
function getField(name: string): HTMLInputElement {
  return document.querySelector(`[data-field="${name}"]`) as HTMLInputElement;
}

/**
 * Simulates user input to fill in the required fields of the Add Clinic
 * form with some sample data.
 *
 * This function is a helper for unit tests and is not intended to
 * be used in production code.
 */
function fillRequiredFields() {
  fireEvent.change(getField('clinicName'), { target: { value: 'Test Clinic' } });
  fireEvent.change(getField('ghlLocationId'), { target: { value: 'loc_test_001' } });
  fireEvent.change(getField('ghlCalendarId'), { target: { value: 'cal_test_001' } });
  fireEvent.change(getField('address'), { target: { value: '123 Queen Street, Cardiff' } });
  fireEvent.change(getField('phoneNumber'), { target: { value: '029 2034 5678' } });
  fireEvent.change(getField('serviceAreas'), { target: { value: 'CF' } });
}

/**
 * Simulates a user clicking the "Save Clinic" button on the Add Clinic form.
 *
 * Finds all buttons with a name matching the regex /save clinic/i and
 * clicks the first one.
 *
 * This function is a helper for unit tests and is not intended to
 * be used in production code.
 */
function clickSave() {
  const saveButtons = screen.getAllByRole('button', { name: /save clinic/i });
  fireEvent.click(saveButtons[0]);
}

describe('AddClinicPage', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockCreateClinic.mockReset();
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('should show all required field errors when form is empty', () => {
    render(<AddClinicPage />);
    clickSave();

    expect(screen.getByText('Clinic name is required')).toBeTruthy();
    expect(screen.getByText('GHL Location ID is required')).toBeTruthy();
    expect(screen.getByText('GHL Calendar ID is required')).toBeTruthy();
    expect(screen.getByText('Address is required')).toBeTruthy();
    expect(screen.getByText('Phone number is required')).toBeTruthy();
    expect(screen.getByText('At least one service area is required')).toBeTruthy();
    expect(mockCreateClinic).not.toHaveBeenCalled();
  });

  it('should reject clinic name shorter than 2 characters', () => {
    render(<AddClinicPage />);
    fireEvent.change(getField('clinicName'), { target: { value: 'A' } });
    fireEvent.change(getField('ghlLocationId'), { target: { value: 'loc_test_001' } });
    fireEvent.change(getField('ghlCalendarId'), { target: { value: 'cal_test_001' } });
    clickSave();
    expect(screen.getByText('Clinic name must be at least 2 characters')).toBeTruthy();
  });

  it('should reject ghlLocationId with non-alphanumeric characters', () => {
    render(<AddClinicPage />);
    fireEvent.change(getField('clinicName'), { target: { value: 'Test Clinic' } });
    fireEvent.change(getField('ghlLocationId'), { target: { value: 'bad id!' } });
    fireEvent.change(getField('ghlCalendarId'), { target: { value: 'cal_test_001' } });
    clickSave();
    expect(screen.getByText(/must be alphanumeric/i)).toBeTruthy();
  });

  it('should reject ghlCalendarId with non-alphanumeric characters', () => {
    render(<AddClinicPage />);
    fireEvent.change(getField('clinicName'), { target: { value: 'Test Clinic' } });
    fireEvent.change(getField('ghlLocationId'), { target: { value: 'loc_test_001' } });
    fireEvent.change(getField('ghlCalendarId'), { target: { value: 'bad cal!' } });
    clickSave();
    expect(screen.getByText(/must be alphanumeric/i)).toBeTruthy();
  });

  it('should reject invalid UK phone number', () => {
    render(<AddClinicPage />);
    fillRequiredFields();
    fireEvent.change(getField('phoneNumber'), { target: { value: 'not a phone' } });
    clickSave();
    expect(screen.getByText(/valid UK phone number/i)).toBeTruthy();
  });

  it('should reject invalid postcode prefix', () => {
    render(<AddClinicPage />);
    fillRequiredFields();
    fireEvent.change(getField('serviceAreas'), { target: { value: 'CF10' } });
    clickSave();
    expect(screen.getByText(/not a valid postcode prefix/i)).toBeTruthy();
  });

  it('should show success toast on successful save', async () => {
    mockCreateClinic.mockResolvedValue({ _id: 'new_id' });
    render(<AddClinicPage />);
    fillRequiredFields();
    clickSave();

    await waitFor(() => {
      expect(screen.getByText('Clinic created successfully')).toBeTruthy();
    });
    expect(mockCreateClinic).toHaveBeenCalledTimes(1);
  });

  it('should show duplicate error on 409 conflict', async () => {
    mockCreateClinic.mockRejectedValue({
      status: 409,
      message: 'A clinic with this GHL Location ID already exists',
    });
    render(<AddClinicPage />);
    fillRequiredFields();
    clickSave();

    await waitFor(() => {
      expect(screen.getByText('A clinic with this GHL Location ID already exists')).toBeTruthy();
    });
  });

  it('should show form error for generic API failures', async () => {
    mockCreateClinic.mockRejectedValue({ status: 500, message: 'Internal server error' });
    render(<AddClinicPage />);
    fillRequiredFields();
    clickSave();

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeTruthy();
    });
  });

  it('should disable save button while submitting', async () => {
    mockCreateClinic.mockReturnValue(new Promise(() => {}));
    render(<AddClinicPage />);
    fillRequiredFields();
    clickSave();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /saving/i })[0]).toBeDisabled();
    });
  });

  it('should clear field error when user types in the field', () => {
    render(<AddClinicPage />);
    clickSave();
    expect(screen.getByText('Clinic name is required')).toBeTruthy();

    fireEvent.change(getField('clinicName'), { target: { value: 'New Clinic' } });
    expect(screen.queryByText('Clinic name is required')).toBeNull();
  });

  it('should scroll to first error field on validation failure', () => {
    render(<AddClinicPage />);
    clickSave();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('should pass all form data to createClinic', async () => {
    mockCreateClinic.mockResolvedValue({ _id: 'full_id' });
    render(<AddClinicPage />);

    fillRequiredFields();
    const allInputs = screen.getAllByRole('textbox');
    fireEvent.change(allInputs[1], { target: { value: '123 Test St' } }); // address
    fireEvent.change(getField('phoneNumber'), { target: { value: '029 2034 5678' } });
    fireEvent.change(getField('serviceAreas'), { target: { value: 'CF, NP' } });
    clickSave();

    await waitFor(() => {
      expect(mockCreateClinic).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicName: 'Test Clinic',
          address: '123 Test St',
          phoneNumber: '029 2034 5678',
          serviceAreas: 'CF, NP',
        }),
      );
    });
  });

  it('should trigger save from the footer button', () => {
    render(<AddClinicPage />);
    const saveButtons = screen.getAllByRole('button', { name: /save clinic/i });
    fireEvent.click(saveButtons[1]);
    expect(screen.getByText('Clinic name is required')).toBeTruthy();
  });

  it('should navigate to /clinics when cancel is clicked', () => {
    render(<AddClinicPage />);
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButtons[0]);
    expect(mockPush).toHaveBeenCalledWith('/clinics');
  });
});
