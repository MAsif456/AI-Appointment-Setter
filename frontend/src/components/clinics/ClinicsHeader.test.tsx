import { render, screen, fireEvent } from '@testing-library/react';
import ClinicsHeader from './ClinicsHeader';

// Mock next/link as a simple anchor
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

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
  it('renders the Add Clinic link pointing to /clinics/new', () => {
    render(<ClinicsHeader searchTerm="" onSearchChange={onSearchChange} />);
    const link = screen.getByText('+ Add Clinic').closest('a');
    expect(link).toHaveAttribute('href', '/clinics/new');
  });

  it('calls onSearchChange when the user types in the search input', () => {
    render(<ClinicsHeader searchTerm="" onSearchChange={onSearchChange} />);
    const input = screen.getByPlaceholderText('Search clinics...');

    fireEvent.change(input, { target: { value: 'Cardiff' } });

    expect(onSearchChange).toHaveBeenCalledWith('Cardiff');
  });
});
