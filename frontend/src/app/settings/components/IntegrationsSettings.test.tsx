import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntegrationsSettings from './IntegrationsSettings';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn() },
}));
const mockApi = api as jest.Mocked<typeof api>;

function makeSettings(overrides = {}) {
  return {
    ghlApiKey: '',
    webhookUrl: '',
    ghlConnectionStatus: 'disconnected' as const,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({ data: makeSettings() });
});

describe('IntegrationsSettings', () => {

  // ─── Loading state ─────────────────────────────────────────────────────────

  it('shows a loading indicator while fetching settings', () => {
    // Never resolve so the loading state is visible
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<IntegrationsSettings />);
    expect(screen.getByText(/Loading integration settings/)).toBeInTheDocument();
  });

  // ─── Initial render ────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders the page heading after loading', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));
    });

    it('shows "Not Connected" when status is disconnected', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
      });
    });

    it('shows "Connected" when status is connected', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('shows error when loading fails', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(
          screen.getByText('Failed to load integration settings. Please refresh the page.'),
        ).toBeInTheDocument();
      });
    });

    it('pre-fills webhook URL from loaded settings', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ webhookUrl: 'https://example.com/hook' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/https:\/\/your-domain/)).toHaveValue(
          'https://example.com/hook',
        );
      });
    });

    it('shows masked key as placeholder when a key is stored', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlApiKey: '••••••••••••abc123', ghlConnectionStatus: 'connected' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter new token to replace current'),
        ).toBeInTheDocument();
      });
    });

    it('shows Calendly coming soon section', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByText('Calendly Integration')).toBeInTheDocument();
        expect(screen.getByText('Coming soon.')).toBeInTheDocument();
      });
    });
  });

  // ─── Eye toggle ────────────────────────────────────────────────────────────

  describe('API key visibility toggle', () => {
    it('toggles the API key field between password and text', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));

      const input = screen.getByPlaceholderText(/Enter your GHL/);
      expect(input).toHaveAttribute('type', 'password');

      // The eye icon button is the only button visible before a key is saved
      const eyeButton = document.querySelector('button[type="button"]') as HTMLElement;
      fireEvent.click(eyeButton);
      expect(input).toHaveAttribute('type', 'text');

      fireEvent.click(eyeButton);
      expect(input).toHaveAttribute('type', 'password');
    });
  });

  // ─── Validation ────────────────────────────────────────────────────────────

  describe('client-side validation', () => {
    it('shows error when API key is shorter than 10 chars', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));

      await userEvent.type(screen.getByPlaceholderText(/Enter your GHL/), 'short');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(
          screen.getByText('API key must be at least 10 characters.'),
        ).toBeInTheDocument();
      });
      expect(mockApi.put).not.toHaveBeenCalled();
    });

    it('shows error when webhook URL is not HTTPS', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));

      await userEvent.type(
        screen.getByPlaceholderText(/https:\/\/your-domain/),
        'http://insecure.com/hook',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(
          screen.getByText('Webhook URL must be a valid HTTPS URL.'),
        ).toBeInTheDocument();
      });
      expect(mockApi.put).not.toHaveBeenCalled();
    });
  });

  // ─── Save ──────────────────────────────────────────────────────────────────

  describe('Save', () => {
    it('Save Changes button is disabled when form is clean', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    });

    it('Save Changes button becomes enabled when API key is entered', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));

      await userEvent.type(screen.getByPlaceholderText(/Enter your GHL/), 'my-key-abc123');
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    });

    it('calls PUT /api/integrations and shows success message', async () => {
      const updatedSettings = makeSettings({ ghlApiKey: '••••••••••••abc123', webhookUrl: '' });
      mockApi.put.mockResolvedValue({ data: updatedSettings });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));

      await userEvent.type(
        screen.getByPlaceholderText(/Enter your GHL/),
        'my-api-key-abc123',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith(
          '/api/integrations',
          expect.objectContaining({ ghlApiKey: 'my-api-key-abc123' }),
        );
        expect(screen.getByText('Settings saved successfully.')).toBeInTheDocument();
      });
    });

    it('shows backend error message when save fails', async () => {
      mockApi.put.mockRejectedValue({
        response: { data: { message: 'Could not connect to GoHighLevel.' } },
      });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));

      await userEvent.type(screen.getByPlaceholderText(/Enter your GHL/), 'my-key-abc123');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(screen.getByText('Could not connect to GoHighLevel.')).toBeInTheDocument();
      });
    });

    it('shows generic error when save fails without a response body', async () => {
      mockApi.put.mockRejectedValue(new Error('Network error'));
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));

      await userEvent.type(screen.getByPlaceholderText(/Enter your GHL/), 'my-key-abc123');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to save settings.')).toBeInTheDocument();
      });
    });
  });

  // ─── Cancel ────────────────────────────────────────────────────────────────

  describe('Cancel', () => {
    it('Cancel button is hidden when form is clean', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('Cancel button appears when form is dirty and reverts changes', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ webhookUrl: 'https://original.com/hook' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));

      const webhookInput = screen.getByPlaceholderText(/https:\/\/your-domain/);
      await userEvent.clear(webhookInput);
      await userEvent.type(webhookInput, 'https://new.com/hook');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(webhookInput).toHaveValue('https://original.com/hook');
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  // ─── Test Connection ───────────────────────────────────────────────────────

  describe('Test Connection', () => {
    it('is not shown when disconnected', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not Connected'));
      expect(screen.queryByRole('button', { name: 'Test Connection' })).not.toBeInTheDocument();
    });

    it('is not shown when form is dirty', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Connected'));

      await userEvent.type(
        screen.getByPlaceholderText('Enter new token to replace current'),
        'new-key',
      );
      expect(screen.queryByRole('button', { name: 'Test Connection' })).not.toBeInTheDocument();
    });

    it('is shown when connected and form is clean', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Test Connection' })).toBeInTheDocument();
      });
    });

    it('shows success message when connection test passes', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      mockApi.post.mockResolvedValue({ data: { connected: true } });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Test Connection' }));

      fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(screen.getByText('Connection successful — GoHighLevel is reachable.')).toBeInTheDocument();
      });
    });

    it('shows error message when connection test returns false', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      mockApi.post.mockResolvedValue({ data: { connected: false } });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Test Connection' }));

      fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(screen.getByText('Connection failed — check your API key.')).toBeInTheDocument();
      });
    });

    it('shows server error when test-connection throws', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      mockApi.post.mockRejectedValue(new Error('Network error'));
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Test Connection' }));

      fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(screen.getByText('Could not reach the server. Please try again.')).toBeInTheDocument();
      });
    });
  });

  // ─── Disconnect ────────────────────────────────────────────────────────────

  describe('Disconnect', () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
    });

    it('is not shown when disconnected', async () => {
      mockApi.get.mockResolvedValue({ data: makeSettings() });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not Connected'));
      expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
    });

    it('shows confirmation prompt when Disconnect is clicked', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

      expect(
        screen.getByText('Are you sure? This will stop all AI booking services.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Yes, Disconnect' })).toBeInTheDocument();
    });

    it('hides confirmation prompt when Cancel is clicked', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(
        screen.queryByText('Are you sure? This will stop all AI booking services.'),
      ).not.toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('calls POST /api/integrations/disconnect and shows success message', async () => {
      mockApi.post.mockResolvedValue({});
      // After disconnect, reload returns disconnected state
      mockApi.get
        .mockResolvedValueOnce({ data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }) })
        .mockResolvedValue({ data: makeSettings() });

      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      fireEvent.click(screen.getByRole('button', { name: 'Yes, Disconnect' }));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/api/integrations/disconnect');
        expect(screen.getByText('GoHighLevel integration disconnected.')).toBeInTheDocument();
      });
    });

    it('shows error message when disconnect fails', async () => {
      mockApi.post.mockRejectedValue(new Error('Server error'));
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      fireEvent.click(screen.getByRole('button', { name: 'Yes, Disconnect' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to disconnect. Please try again.')).toBeInTheDocument();
      });
    });
  });
});