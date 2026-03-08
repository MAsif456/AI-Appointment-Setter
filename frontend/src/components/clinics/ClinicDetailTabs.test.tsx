import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClinicDetailTabs from './ClinicDetailTabs';
import type { Clinic } from '@/types/clinic';
import { updateClinicSettings } from '@/lib/api/clinics';

// Mock the ClinicSettingsForm so the test stays focused on tab behaviour
jest.mock('@/components/EditClinicsDetails/ClinicSettingsForm', () => {
  const { forwardRef } = require('react');
  return {
    __esModule: true,
    default: forwardRef(function MockSettingsForm(
      props: { onSave: (clinic: any) => void },
      ref: any,
    ) {
      return (
        <form
          ref={ref}
          data-testid="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            props.onSave({ ...mockClinicData, name: 'Updated Name' });
          }}
        >
          Mock Settings Form
        </form>
      );
    }),
  };
});

jest.mock('@/lib/api/clinics', () => ({
  updateClinicSettings: jest.fn(),
}));

const mockedUpdateSettings = updateClinicSettings as jest.MockedFunction<typeof updateClinicSettings>;

const mockClinicData = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Cardiff Physiotherapy Centre',
  ghlLocationId: 'loc_cardiff_001',
  ghlCalendarId: 'cal_cardiff_001',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  serviceAreas: [{ postcodePrefix: 'CF' }],
  businessHours: [{ day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' }],
  todayLeadsCount: 12,
  todayBookingsCount: 5,
  monthLeadsCount: 245,
  monthBookingsCount: 103,
  isActive: true,
  defaultAppointmentDuration: 30,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
} as Clinic;

describe('ClinicDetailTabs', () => {
  afterEach(() => jest.clearAllMocks());

  /** Verifies all five tab buttons are rendered. */
  it('renders all tab buttons', () => {
    render(<ClinicDetailTabs clinic={mockClinicData} />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('AI Configuration')).toBeInTheDocument();
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  /** Verifies the Overview tab is active by default. */
  it('shows Overview content by default', () => {
    render(<ClinicDetailTabs clinic={mockClinicData} />);

    expect(
      screen.getByText('Clinic overview would go here...'),
    ).toBeInTheDocument();
  });

  /** Verifies clicking the Settings tab renders the settings form. */
  it('renders the settings form when the Settings tab is clicked', () => {
    render(<ClinicDetailTabs clinic={mockClinicData} />);

    fireEvent.click(screen.getByText('Settings'));

    expect(screen.getByTestId('settings-form')).toBeInTheDocument();
    expect(screen.getByText('Save Settings')).toBeInTheDocument();
  });

  /** Verifies non-settings tabs still render placeholder content. */
  it('renders correct placeholder for non-settings tabs', () => {
    render(<ClinicDetailTabs clinic={mockClinicData} />);

    const placeholderTabs = ['Overview', 'AI Configuration', 'Conversations', 'Analytics'];

    for (const tab of placeholderTabs) {
      fireEvent.click(screen.getByText(tab));
      expect(
        screen.getByText(`Clinic ${tab.toLowerCase()} would go here...`),
      ).toBeInTheDocument();
    }
  });

  /** Verifies the save flow shows a success banner. */
  it('shows success banner after saving settings', async () => {
    const updatedClinic = { ...mockClinicData, name: 'Updated Name' };
    mockedUpdateSettings.mockResolvedValue(updatedClinic);
    const onClinicUpdated = jest.fn();

    render(<ClinicDetailTabs clinic={mockClinicData} onClinicUpdated={onClinicUpdated} />);

    fireEvent.click(screen.getByText('Settings'));

    // Submit the form via requestSubmit
    const form = screen.getByTestId('settings-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Settings saved successfully.');
    });

    expect(mockedUpdateSettings).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ name: 'Updated Name' }),
    );
    expect(onClinicUpdated).toHaveBeenCalledWith(updatedClinic);
  });

  /** Verifies the save flow shows an error message on failure. */
  it('shows error message when saving settings fails', async () => {
    mockedUpdateSettings.mockRejectedValue(new Error('Network error'));

    render(<ClinicDetailTabs clinic={mockClinicData} />);

    fireEvent.click(screen.getByText('Settings'));

    const form = screen.getByTestId('settings-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});
