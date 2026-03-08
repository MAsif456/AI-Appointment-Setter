import { render, screen, fireEvent } from '@testing-library/react';
import ClinicsHeader from './ClinicsHeader';

describe('ClinicsHeader', () => {
  const onSearchChange = jest.fn();

  afterEach(() => jest.clearAllMocks());

  it('renders the page title', () => {
    render(<ClinicsHeader searchTerm="" onSearchChange={onSearchChange} />);
    expect(screen.getByText('Clinics')).toBeInTheDocument();
  });

  it('renders the search input with placeholder', () => {
    render(<ClinicsHeader searchTerm="" onSearchChange={onSearchChange} />);
    expect(screen.getByPlaceholderText('Search clinics...')).toBeInTheDocument();
  });

  it('renders the Add Clinic button (non-navigating)', () => {
    render(<ClinicsHeader searchTerm="" onSearchChange={onSearchChange} />);
    const btn = screen.getByText('+ Add Clinic');
    expect(btn.tagName).toBe('BUTTON');
  });

  it('calls onSearchChange when the user types in the search input', () => {
    render(<ClinicsHeader searchTerm="" onSearchChange={onSearchChange} />);
    const input = screen.getByPlaceholderText('Search clinics...');

    fireEvent.change(input, { target: { value: 'Cardiff' } });

    expect(onSearchChange).toHaveBeenCalledWith('Cardiff');
  });
});
