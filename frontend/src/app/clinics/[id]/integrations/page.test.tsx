import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClinicIntegrationsPage from './page';
import * as clinicsApi from '@/lib/api/clinics';
import { Clinic } from '@/types/clinic';

jest.mock('@/lib/api/clinics');
const api = clinicsApi as jest.Mocked<typeof clinicsApi>;

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'clinic_abc' }),
}));

function makeClinic(overrides: Partial<Clinic> = {}): Clinic {
  return {
    _id: 'clinic_abc',
    name: 'Cardiff Physio',
    ghlLocationId: 'loc_1',
    ghlCalendarId: 'cal_1',
    serviceAreas: [],
    businessHours: [],
    todayLeadsCount: 0,
    todayBookingsCount: 0,
    monthLeadsCount: 0,
    monthBookingsCount: 0,
    defaultAppointmentDuration: 30,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: clinic has no integration configured
  api.getClinicById.mockResolvedValue(makeClinic());
  api.updateClinicIntegration.mockResolvedValue(undefined);
  api.testClinicIntegration.mockResolvedValue({ connected: true });
  api.disconnectClinicIntegration.mockResolvedValue(undefined);
});

describe('ClinicIntegrationsPage', () => {

  // ─── Initial render ────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders the page heading', async () => {
      render(<ClinicIntegrationsPage />);
      expect(screen.getByText('GoHighLevel Integration')).toBeInTheDocument();
    });

    it('shows "Not connected" badge when clinic has no API key', async () => {
      render(<ClinicIntegrationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Not connected')).toBeInTheDocument();
      });
    });

    it('shows "Connected" badge when clinic already has a masked key', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('pre-fills webhook URL from clinic data', async () => {
      api.getClinicById.mockResolvedValue(
        makeClinic({ webhookUrl: 'https://example.com/hook' }),
      );
      render(<ClinicIntegrationsPage />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/https:\/\/your-domain/)).toHaveValue(
          'https://example.com/hook',
        );
      });
    });

    it('shows masked key preview when one is stored', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••xyz789' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => {
        expect(screen.getByText('••••••••••••xyz789')).toBeInTheDocument();
      });
    });

    it('shows "Connected" when initialMaskedKey prop is provided', async () => {
      render(<ClinicIntegrationsPage initialMaskedKey="••••••••••••abc123" clinicId="clinic_abc" />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  // ─── Save ──────────────────────────────────────────────────────────────────

  describe('Save', () => {
    it('shows error toast when saving with empty API key field', async () => {
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Save'));

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Please enter an API key')).toBeInTheDocument();
      });
      expect(api.updateClinicIntegration).not.toHaveBeenCalled();
    });

    it('calls updateClinicIntegration with the entered key', async () => {
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Save'));

      await userEvent.type(
        screen.getByPlaceholderText(/Enter GHL/),
        'new-api-key-abc123',
      );
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(api.updateClinicIntegration).toHaveBeenCalledWith(
          'clinic_abc',
          'new-api-key-abc123',
          undefined,
        );
      });
    });

    it('shows success toast after a successful save', async () => {
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Save'));

      await userEvent.type(screen.getByPlaceholderText(/Enter GHL/), 'valid-key-abc');
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Integration saved')).toBeInTheDocument();
      });
    });

    it('shows error toast when the backend rejects the key', async () => {
      api.updateClinicIntegration.mockRejectedValue(
        new Error('Could not connect to GoHighLevel. Please check your API key.'),
      );
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Save'));

      await userEvent.type(screen.getByPlaceholderText(/Enter GHL/), 'bad-key');
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(
          screen.getByText('Could not connect to GoHighLevel. Please check your API key.'),
        ).toBeInTheDocument();
      });
    });

    it('passes webhookUrl when provided', async () => {
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Save'));

      await userEvent.type(screen.getByPlaceholderText(/Enter GHL/), 'my-api-key');
      await userEvent.clear(screen.getByPlaceholderText(/https:\/\/your-domain/));
      await userEvent.type(
        screen.getByPlaceholderText(/https:\/\/your-domain/),
        'https://app.example.com/hook',
      );
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(api.updateClinicIntegration).toHaveBeenCalledWith(
          'clinic_abc',
          'my-api-key',
          'https://app.example.com/hook',
        );
      });
    });
  });

  // ─── Test connection ───────────────────────────────────────────────────────

  describe('Test Connection button', () => {
    it('is not rendered when no key is stored', async () => {
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Not connected'));
      expect(screen.queryByText('Test Connection')).not.toBeInTheDocument();
    });

    it('is rendered when a key is already stored', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Test Connection')).toBeInTheDocument();
      });
    });

    it('shows success toast on successful connection test', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      api.testClinicIntegration.mockResolvedValue({ connected: true });
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Test Connection'));

      fireEvent.click(screen.getByText('Test Connection'));

      await waitFor(() => {
        expect(screen.getByText('Connection successful')).toBeInTheDocument();
      });
    });

    it('shows error toast when connection test fails', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      api.testClinicIntegration.mockResolvedValue({ connected: false });
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Test Connection'));

      fireEvent.click(screen.getByText('Test Connection'));

      await waitFor(() => {
        expect(
          screen.getByText('Connection failed — check your API key'),
        ).toBeInTheDocument();
      });
    });

    it('shows server error toast when testClinicIntegration throws', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      api.testClinicIntegration.mockRejectedValue(new Error('Network error'));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Test Connection'));

      fireEvent.click(screen.getByText('Test Connection'));

      await waitFor(() => {
        expect(screen.getByText('Could not reach the server')).toBeInTheDocument();
      });
    });
  });

  // ─── Disconnect ────────────────────────────────────────────────────────────

  describe('Disconnect', () => {
    it('is not rendered when no key is stored', async () => {
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Not connected'));
      expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
    });

    it('opens a confirmation modal when Disconnect is clicked', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Disconnect'));

      fireEvent.click(screen.getByText('Disconnect'));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Remove integration?')).toBeInTheDocument();
    });

    it('calls disconnectClinicIntegration when Remove is confirmed', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Disconnect'));

      fireEvent.click(screen.getByText('Disconnect'));
      fireEvent.click(screen.getByText('Remove'));

      await waitFor(() => {
        expect(api.disconnectClinicIntegration).toHaveBeenCalledWith('clinic_abc');
      });
    });

    it('changes badge to "Not connected" after disconnect', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Disconnect'));

      fireEvent.click(screen.getByText('Disconnect'));
      fireEvent.click(screen.getByText('Remove'));

      await waitFor(() => {
        expect(screen.getByText('Not connected')).toBeInTheDocument();
      });
    });

    it('does not disconnect when Cancel is clicked', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Disconnect'));

      fireEvent.click(screen.getByText('Disconnect'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(api.disconnectClinicIntegration).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the modal when the backdrop is clicked', async () => {
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Disconnect'));

      fireEvent.click(screen.getByText('Disconnect'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click the backdrop (the sibling div behind the panel)
      const overlay = screen.getByRole('dialog');
      // The backdrop is the first child of the overlay
      fireEvent.click(overlay.firstElementChild!);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows error toast when disconnect fails', async () => {
      api.disconnectClinicIntegration.mockRejectedValue(new Error('Network error'));
      api.getClinicById.mockResolvedValue(makeClinic({ ghlApiKey: '••••••••••••abc123' }));
      render(<ClinicIntegrationsPage />);
      await waitFor(() => screen.getByText('Disconnect'));

      fireEvent.click(screen.getByText('Disconnect'));
      fireEvent.click(screen.getByText('Remove'));

      await waitFor(() => {
        expect(screen.getByText('Failed to disconnect')).toBeInTheDocument();
      });
    });
  });
});
