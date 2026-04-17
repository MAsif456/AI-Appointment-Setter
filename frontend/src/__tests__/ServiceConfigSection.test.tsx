/**
 * Tests for the ServiceConfigSection component.
 *
 * Covers the services offered input, the appointment duration
 * dropdown, and change handler invocations for each field.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ServiceConfigSection from '@/components/clinics/ServiceConfigSection';

describe('ServiceConfigSection', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    serviceAreas: '',
    servicesOffered: '',
    appointmentDuration: 30,
    dataRetentionMonths: 12,
    onChange: mockOnChange,
    errors: {} as Record<string, string>,
  };

  beforeEach(() => {
    mockOnChange.mockReset();
  });

  /** Should call onChange when the services offered input is changed. */
  it('should call onChange when services offered is typed into', () => {
    render(<ServiceConfigSection {...defaultProps} />);

    const servicesInput = screen.getByPlaceholderText('e.g., Back pain, Sports injury');
    fireEvent.change(servicesInput, { target: { value: 'Massage' } });

    expect(mockOnChange).toHaveBeenCalledWith('servicesOffered', 'Massage');
  });

  /** Should call onChange with a numeric value when duration is selected. */
  it('should call onChange when appointment duration is changed', () => {
    render(<ServiceConfigSection {...defaultProps} />);

    const select = screen.getByDisplayValue('30 minutes');
    fireEvent.change(select, { target: { value: '60' } });

    expect(mockOnChange).toHaveBeenCalledWith('appointmentDuration', 60);
  });

  /** Should render all duration options in the dropdown. */
  it('should display all duration options', () => {
    render(<ServiceConfigSection {...defaultProps} />);

    expect(screen.getByText('15 minutes')).toBeTruthy();
    expect(screen.getByText('120 minutes')).toBeTruthy();
  });

  /** Should call onChange when service areas input is changed. */
  it('should call onChange when service areas is typed into', () => {
    render(<ServiceConfigSection {...defaultProps} />);

    const input = screen.getByPlaceholderText('e.g., CF, NP, SA (comma separated)');
    fireEvent.change(input, { target: { value: 'CF' } });

    expect(mockOnChange).toHaveBeenCalledWith('serviceAreas', 'CF');
  });
});
