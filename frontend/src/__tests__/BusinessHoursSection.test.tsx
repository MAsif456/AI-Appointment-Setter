/**
 * Tests for the BusinessHoursSection component.
 * Covers time input changes, checkbox toggles, and disabled state for closed days.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BusinessHoursSection from '@/components/clinics/BusinessHoursSection';
import type { WeekHours } from '@/components/clinics/BusinessHoursSection';

/**
 * Builds a default set of business hours with all weekdays open from 09:00 to 17:00,
 * and weekends closed.
 * @returns {weekHours} A default set of business hours.
 */
function buildDefaultHours(): WeekHours {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours: WeekHours = {};
  for (const day of days) {
    hours[day] = {
      open: !['Saturday', 'Sunday'].includes(day),
      start: '09:00',
      end: '17:00',
    };
  }
  return hours;
}

describe('BusinessHoursSection', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => mockOnChange.mockReset());

  it('should render all seven days', () => {
    render(<BusinessHoursSection hours={buildDefaultHours()} onChange={mockOnChange} />);
    expect(screen.getByText('Monday')).toBeTruthy();
    expect(screen.getByText('Sunday')).toBeTruthy();
  });

  it('should call onChange when start time is changed', () => {
    render(<BusinessHoursSection hours={buildDefaultHours()} onChange={mockOnChange} />);
    const timeInputs = screen.getAllByDisplayValue('09:00');
    fireEvent.change(timeInputs[0], { target: { value: '08:00' } });
    expect(mockOnChange).toHaveBeenCalledWith('Monday', 'start', '08:00');
  });

  it('should call onChange when end time is changed', () => {
    render(<BusinessHoursSection hours={buildDefaultHours()} onChange={mockOnChange} />);
    const endTimeInputs = screen.getAllByDisplayValue('17:00');
    fireEvent.change(endTimeInputs[0], { target: { value: '18:00' } });
    expect(mockOnChange).toHaveBeenCalledWith('Monday', 'end', '18:00');
  });

  it('should call onChange when open checkbox is toggled', () => {
    render(<BusinessHoursSection hours={buildDefaultHours()} onChange={mockOnChange} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(mockOnChange).toHaveBeenCalledWith('Monday', 'open', false);
  });

  it('should disable time inputs for closed days', () => {
    render(<BusinessHoursSection hours={buildDefaultHours()} onChange={mockOnChange} />);
    const allTimeInputs = document.querySelectorAll('input[type="time"]');
    // Saturday (index 10,11) should be disabled, Monday (index 0) should not
    expect((allTimeInputs[10] as HTMLInputElement).disabled).toBe(true);
    expect((allTimeInputs[11] as HTMLInputElement).disabled).toBe(true);
    expect((allTimeInputs[0] as HTMLInputElement).disabled).toBe(false);
  });
});
