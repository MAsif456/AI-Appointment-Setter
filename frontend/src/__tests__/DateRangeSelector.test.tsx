/**
 * Unit tests for the DateRangeSelector component.
 * Verifies dropdown options, onChange behaviour, and custom date picker.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import DateRangeSelector from '@/components/Analytics/DateRangeSelector';

describe('DateRangeSelector', () => {
  const mockOnChange = jest.fn();
  const mockOnCustomRange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all preset options', () => {
    render(<DateRangeSelector value="Last 7 days" onChange={mockOnChange} />);

    const select = screen.getByLabelText('Select date range') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Last 7 days');
    expect(options[1].textContent).toBe('Last 30 days');
    expect(options[2].textContent).toBe('Custom range');
  });

  it('should call onChange when selection changes', () => {
    render(<DateRangeSelector value="Last 7 days" onChange={mockOnChange} />);

    const select = screen.getByLabelText('Select date range');
    fireEvent.change(select, { target: { value: 'Last 30 days' } });

    expect(mockOnChange).toHaveBeenCalledWith('Last 30 days');
  });

  it('should show custom date inputs when Custom range is selected', () => {
    render(
      <DateRangeSelector
        value="Custom range"
        onChange={mockOnChange}
        onCustomRange={mockOnCustomRange}
      />,
    );

    // Change to Custom range to show the date inputs
    const select = screen.getByLabelText('Select date range');
    fireEvent.change(select, { target: { value: 'Custom range' } });

    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('should call onCustomRange when Apply is clicked with dates', () => {
    render(
      <DateRangeSelector
        value="Custom range"
        onChange={mockOnChange}
        onCustomRange={mockOnCustomRange}
      />,
    );

    // Trigger custom range display
    const select = screen.getByLabelText('Select date range');
    fireEvent.change(select, { target: { value: 'Custom range' } });

    // Set dates and apply
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-03-15' } });
    fireEvent.click(screen.getByText('Apply'));

    expect(mockOnCustomRange).toHaveBeenCalledWith('2026-03-01', '2026-03-15');
  });

  it('should not show custom inputs for preset options', () => {
    render(<DateRangeSelector value="Last 7 days" onChange={mockOnChange} />);

    expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('End date')).not.toBeInTheDocument();
  });
});
