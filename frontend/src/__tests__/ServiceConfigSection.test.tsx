/**
 * Tests for the ServiceConfigSection component.
 *
 * Covers pill-based service and area management, dropdown selection,
 * custom input addition, and removal via X buttons.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ServiceConfigSection from '@/components/clinics/ServiceConfigSection';

describe('ServiceConfigSection', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    serviceAreas: ['CF', 'NP'],
    servicesOffered: ['Back pain', 'Sports injury'],
    onChange: mockOnChange,
    errors: {} as Record<string, string>,
  };

  beforeEach(() => {
    mockOnChange.mockReset();
  });

  it('renders the section title', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    expect(screen.getByText('Services & Locations')).toBeInTheDocument();
  });

  it('renders existing services as pills', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    expect(screen.getByText('Back pain')).toBeInTheDocument();
    expect(screen.getByText('Sports injury')).toBeInTheDocument();
  });

  it('renders existing service areas as pills', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    expect(screen.getByText('CF')).toBeInTheDocument();
    expect(screen.getByText('NP')).toBeInTheDocument();
  });

  it('removes a service when X is clicked', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const removeBtn = screen.getByLabelText('Remove Back pain');
    fireEvent.click(removeBtn);
    expect(mockOnChange).toHaveBeenCalledWith('servicesOffered', ['Sports injury']);
  });

  it('removes a service area when X is clicked', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const removeBtn = screen.getByLabelText('Remove CF');
    fireEvent.click(removeBtn);
    expect(mockOnChange).toHaveBeenCalledWith('serviceAreas', ['NP']);
  });

  it('adds a service from the dropdown', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const select = screen.getByDisplayValue('Select a service...');
    fireEvent.change(select, { target: { value: 'Rehabilitation' } });
    expect(mockOnChange).toHaveBeenCalledWith('servicesOffered', [
      'Back pain', 'Sports injury', 'Rehabilitation',
    ]);
  });

  it('adds a service area from the dropdown', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const select = screen.getByDisplayValue('Select a service area...');
    fireEvent.change(select, { target: { value: 'SA' } });
    expect(mockOnChange).toHaveBeenCalledWith('serviceAreas', ['CF', 'NP', 'SA']);
  });

  it('adds a custom service via the Add button', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const input = screen.getByPlaceholderText('Or add a custom service...');
    fireEvent.change(input, { target: { value: 'Massage therapy' } });
    const addBtns = screen.getAllByText('+ Add');
    fireEvent.click(addBtns[0]);
    expect(mockOnChange).toHaveBeenCalledWith('servicesOffered', [
      'Back pain', 'Sports injury', 'Massage therapy',
    ]);
  });

  it('adds a custom service area via the Add button', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const input = screen.getByPlaceholderText('Or add a custom postcode prefix...');
    fireEvent.change(input, { target: { value: 'LD' } });
    const addBtns = screen.getAllByText('+ Add');
    fireEvent.click(addBtns[1]);
    expect(mockOnChange).toHaveBeenCalledWith('serviceAreas', ['CF', 'NP', 'LD']);
  });

  it('adds a custom service on Enter key press', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const input = screen.getByPlaceholderText('Or add a custom service...');
    fireEvent.change(input, { target: { value: 'Acupuncture' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnChange).toHaveBeenCalledWith('servicesOffered', [
      'Back pain', 'Sports injury', 'Acupuncture',
    ]);
  });

  it('does not add duplicate services', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const input = screen.getByPlaceholderText('Or add a custom service...');
    fireEvent.change(input, { target: { value: 'Back pain' } });
    const addBtns = screen.getAllByText('+ Add');
    fireEvent.click(addBtns[0]);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('does not add duplicate service areas', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const input = screen.getByPlaceholderText('Or add a custom postcode prefix...');
    fireEvent.change(input, { target: { value: 'CF' } });
    const addBtns = screen.getAllByText('+ Add');
    fireEvent.click(addBtns[1]);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows error message when serviceAreas has an error', () => {
    render(
      <ServiceConfigSection
        {...defaultProps}
        errors={{ serviceAreas: 'At least one service area is required' }}
      />,
    );
    expect(screen.getByText('At least one service area is required')).toBeInTheDocument();
  });

  it('excludes already-selected services from dropdown', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const select = screen.getByDisplayValue('Select a service...');
    const options = select.querySelectorAll('option');
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts).not.toContain('Back pain');
    expect(optionTexts).not.toContain('Sports injury');
    expect(optionTexts).toContain('Rehabilitation');
  });

  it('shows helper text for service areas', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    expect(screen.getByText(/These postcode prefixes determine/)).toBeInTheDocument();
  });

  it('renders at least 10 preset services in dropdown when none selected', () => {
    render(
      <ServiceConfigSection
        {...defaultProps}
        servicesOffered={[]}
      />,
    );
    const select = screen.getByDisplayValue('Select a service...');
    // Count non-disabled options (subtract the placeholder)
    const options = select.querySelectorAll('option:not([disabled])');
    expect(options.length).toBeGreaterThanOrEqual(10);
  });

  it('renders at least 6 preset areas in dropdown when none selected', () => {
    render(
      <ServiceConfigSection
        {...defaultProps}
        serviceAreas={[]}
      />,
    );
    const select = screen.getByDisplayValue('Select a service area...');
    const options = select.querySelectorAll('option:not([disabled])');
    expect(options.length).toBeGreaterThanOrEqual(6);
  });

  it('uppercases custom service area input', () => {
    render(<ServiceConfigSection {...defaultProps} />);
    const input = screen.getByPlaceholderText('Or add a custom postcode prefix...');
    fireEvent.change(input, { target: { value: 'bs' } });
    const addBtns = screen.getAllByText('+ Add');
    fireEvent.click(addBtns[1]);
    expect(mockOnChange).toHaveBeenCalledWith('serviceAreas', ['CF', 'NP', 'BS']);
  });
});
