import { render, screen } from '@testing-library/react';
import EmptyState from '@/components/clinics/EmptyState';

describe('EmptyState', () => {
  it('shows "No clinics found" when search is active', () => {
    render(<EmptyState hasSearch={true} />);
    expect(screen.getByText('No clinics found')).toBeInTheDocument();
  });

  it('shows "No clinics configured yet" with Add button when no search', () => {
    render(<EmptyState hasSearch={false} />);
    expect(screen.getByText('No clinics configured yet')).toBeInTheDocument();
    expect(screen.getByText('Add Clinic')).toBeInTheDocument();
  });

  it('does not show Add Clinic button when search is active', () => {
    render(<EmptyState hasSearch={true} />);
    expect(screen.queryByText('Add Clinic')).not.toBeInTheDocument();
  });
});
