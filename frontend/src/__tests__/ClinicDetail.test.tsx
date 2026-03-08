/**
 * Tests for ClinicDetail.
 *
 * Covers tab navigation, edit/cancel/save flows, the PATCH fetch call,
 * success and error banners, and that local clinic state updates on save.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClinicDetail from '@/components/EditClinicsDetails/ClinicDetail';
import type { Clinic } from '@/components/EditClinicsDetails/types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

jest.mock('@/components/EditClinicsDetails/BusinessHoursEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="business-hours-editor" />,
}));

const baseClinic: Clinic = {
  _id: 'abc123',
  name: 'Cardiff Physio',
  address: '1 High Street, Cardiff',
  phone: '029 2034 5678',
  ghlLocationId: 'loc_cardiff_001',
  isActive: true,
  serviceAreas: [{ postcodePrefix: 'CF' }],
  businessHours: [{ day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' }],
  monthLeadsCount: 4,
  monthBookingsCount: 2,
};

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('ClinicDetail', () => {
  it('renders the clinic name in the header', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    expect(screen.getByRole('heading', { name: 'Cardiff Physio' })).toBeTruthy();
  });

  it('defaults to the Settings tab and shows the read-only view', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    expect(screen.getByText('Basic Information')).toBeTruthy();
    expect(screen.queryByLabelText('Clinic Name')).toBeNull();
  });

  it('shows all five tab buttons', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    ['Overview', 'Settings', 'AI Configuration', 'Conversations', 'Analytics'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    });
  });

  it('switches to the Overview tab placeholder', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(screen.getByText('Clinic overview will be added here.')).toBeTruthy();
  });

  it('switches to the AI Configuration tab placeholder', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI Configuration' }));
    expect(screen.getByText('AI configuration UI will be added here.')).toBeTruthy();
  });

  it('switches to the Conversations tab placeholder', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conversations' }));
    expect(screen.getByText('Recent conversations for this clinic will appear here.')).toBeTruthy();
  });

  it('switches to the Analytics tab placeholder', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
    expect(screen.getByText('Conversion and performance analytics will appear here.')).toBeTruthy();
  });

  it('enters edit mode when the Edit button is clicked', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    expect(screen.getByLabelText('Clinic Name')).toBeTruthy();
  });

  it('returns to read-only mode when Cancel is clicked', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Clinic Name')).toBeNull();
    expect(screen.getByText('Basic Information')).toBeTruthy();
  });

  it('exits edit mode when switching away from the Settings tab', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByLabelText('Clinic Name')).toBeNull();
  });

  it('shows success banner after a successful save', async () => {
    const savedClinic = { ...baseClinic, name: 'Updated Name' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(savedClinic),
    });

    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText('Settings updated')).toBeTruthy();
    });
  });

  it('updates the displayed clinic name after a successful save', async () => {
    const savedClinic = { ...baseClinic, name: 'Updated Name' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(savedClinic),
    });

    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Updated Name' })).toBeTruthy();
    });
  });

  it('returns to read-only mode after a successful save', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(baseClinic),
    });

    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.queryByLabelText('Clinic Name')).toBeNull();
    });
  });

  it('shows an error banner when the fetch returns a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Bad Request'),
    });

    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText('Bad Request')).toBeTruthy();
    });
  });

  it('shows a generic error when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('sends a PATCH request to the correct URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(baseClinic),
    });

    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/clinics/abc123/settings'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('shows Save Changes button while in edit mode', () => {
    render(<ClinicDetail initialClinic={baseClinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeTruthy();
  });
});
