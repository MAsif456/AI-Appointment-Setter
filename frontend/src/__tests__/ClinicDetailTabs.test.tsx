import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClinicDetailTabs from '@/components/clinics/ClinicDetailTabs';
import type { Clinic } from '@/types/clinic';
import { updateClinicSettings } from '@/lib/api/clinics';

// Mock the ClinicSettingsForm so the test stays focused on tab behaviour.
// Uses useImperativeHandle to expose submit() matching the real component's handle type.
jest.mock('@/components/EditClinicsDetails/ClinicSettingsForm', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  return {
    __esModule: true,
    default: forwardRef(function MockSettingsForm(
      props: { onSave: (clinic: any) => void },
      ref: any,
    ) {
      useImperativeHandle(ref, () => ({
        submit: () => props.onSave({ ...mockClinicData, name: 'Updated Name' }),
      }));
      return <div data-testid="settings-form">Mock Settings Form</div>;
    }),
  };
});

jest.mock('@/lib/api/clinics', () => ({
  updateClinicSettings: jest.fn(),
}));

// Mock all AI Configuration sub-components
jest.mock('@/components/AIConfiguration/ToneSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="tone-selector">ToneSelector</div>,
}));
jest.mock('@/components/AIConfiguration/GreetingMessage', () => ({
  __esModule: true,
  default: () => <div data-testid="greeting-message">GreetingMessage</div>,
}));
jest.mock('@/components/AIConfiguration/QualificationQuestions', () => ({
  __esModule: true,
  default: () => <div data-testid="qualification-questions">QualificationQuestions</div>,
}));
jest.mock('@/components/AIConfiguration/CustomInstructions', () => ({
  __esModule: true,
  default: () => <div data-testid="custom-instructions">CustomInstructions</div>,
}));
jest.mock('@/components/AIConfiguration/SaveBar', () => ({
  __esModule: true,
  default: () => <div data-testid="save-bar">SaveBar</div>,
}));

// Mock the AI settings API
jest.mock('@/lib/ai-settings-api', () => ({
  fetchAiSettings: jest.fn().mockResolvedValue({
    tone: 'friendly',
    greetingTemplate: 'Hello!',
    qualificationQuestions: [],
    customInstructions: '',
  }),
  saveAiSettings: jest.fn().mockResolvedValue({}),
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

  /** Verifies the settings form renders when isEditing is true. */
  it('renders the settings form when isEditing is true', () => {
    render(<ClinicDetailTabs clinic={mockClinicData} isEditing={true} />);

    expect(screen.getByTestId('settings-form')).toBeInTheDocument();
    expect(screen.getAllByText('Save Settings').length).toBeGreaterThan(0);
  });
  /** Verifies non-settings tabs still render placeholder content. */
  it('renders correct placeholder for non-settings tabs', () => {
    render(<ClinicDetailTabs clinic={mockClinicData} />);

    const placeholderTabs = ['Overview', 'Conversations'];

    for (const tab of placeholderTabs) {
      fireEvent.click(screen.getByText(tab));
      expect(
        screen.getByText(`Clinic ${tab.toLowerCase()} would go here...`),
      ).toBeInTheDocument();
    }
  });

  /** Verifies the AI Configuration tab renders the AI components after loading. */
  it('renders AI configuration components when AI Configuration tab is clicked', async () => {
    render(<ClinicDetailTabs clinic={mockClinicData} />);

    fireEvent.click(screen.getByText('AI Configuration'));

    // First shows loading
    expect(screen.getByText('Loading AI settings...')).toBeInTheDocument();

    // Then renders the AI components after fetch resolves
    await waitFor(() => {
      expect(screen.getByTestId('tone-selector')).toBeInTheDocument();
    });
    expect(screen.getByTestId('greeting-message')).toBeInTheDocument();
    expect(screen.getByTestId('qualification-questions')).toBeInTheDocument();
    expect(screen.getByTestId('custom-instructions')).toBeInTheDocument();
    expect(screen.getByTestId('save-bar')).toBeInTheDocument();
  });

  /** Verifies the save flow calls onClinicUpdated and switches back to view mode. */
  it('calls onClinicUpdated and exits edit mode after saving settings', async () => {
    const updatedClinic = { ...mockClinicData, name: 'Updated Name' };
    mockedUpdateSettings.mockResolvedValue(updatedClinic);
    const onClinicUpdated = jest.fn();
    const onEditingChange = jest.fn();

    render(
      <ClinicDetailTabs
        clinic={mockClinicData}
        isEditing={true}
        onClinicUpdated={onClinicUpdated}
        onEditingChange={onEditingChange}
      />
    );

    // Trigger save via the bottom footer button
    fireEvent.click(screen.getAllByText('Save Settings')[0]);

    await waitFor(() => {
      expect(mockedUpdateSettings).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ name: 'Updated Name' }),
      );
    });
    expect(onClinicUpdated).toHaveBeenCalledWith(updatedClinic);
    expect(onEditingChange).toHaveBeenCalledWith(false);
  });

  /** Verifies the save flow shows a success banner when view mode is restored. */
  it('shows success banner after saving settings', async () => {
    const updatedClinic = { ...mockClinicData, name: 'Updated Name' };
    mockedUpdateSettings.mockResolvedValue(updatedClinic);

    function Wrapper() {
      const [editing, setEditing] = React.useState(true);
      return (
        <ClinicDetailTabs
          clinic={mockClinicData}
          isEditing={editing}
          onEditingChange={setEditing}
        />
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getAllByText('Save Settings')[0]);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Settings saved successfully.');
    });
  });

  /** Verifies the save flow shows an error message on failure. */
  it('shows error message when saving settings fails', async () => {
    mockedUpdateSettings.mockRejectedValue(new Error('Network error'));

    render(<ClinicDetailTabs clinic={mockClinicData} isEditing={true} />);

    fireEvent.click(screen.getAllByText('Save Settings')[0]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});
