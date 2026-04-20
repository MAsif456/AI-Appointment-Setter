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

  it('shows "Loading…" in the status row while fetching', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<IntegrationsSettings />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  // ─── Initial render ────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders the section heading', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('GoHighLevel Integration'));
    });

    it('shows "Not connected" status dot when no key is stored', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByText('Not connected')).toBeInTheDocument();
      });
    });

    it('shows "Connected" status dot when a key is stored', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('shows the masked key next to the status when connected', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByText('••••••••••••abc123')).toBeInTheDocument();
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

    it('shows "Enter new token to replace current" placeholder when a key is stored', async () => {
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

    it('shows error toast when loading fails', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(
          screen.getByText('Failed to load integration settings. Please refresh the page.'),
        ).toBeInTheDocument();
      });
    });

    it('shows the Calendly coming soon section', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByText('Calendly Integration')).toBeInTheDocument();
        expect(screen.getByText('Coming soon.')).toBeInTheDocument();
      });
    });
  });

  // ─── Save ──────────────────────────────────────────────────────────────────

  describe('Save', () => {
    it('shows error toast when saving with empty API key', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not connected'));

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Please enter an API key')).toBeInTheDocument();
      });
      expect(mockApi.put).not.toHaveBeenCalled();
    });

    it('calls PUT /api/integrations with the entered key', async () => {
      mockApi.put.mockResolvedValue({
        data: makeSettings({ ghlApiKey: '••••••••••••abc123', ghlConnectionStatus: 'connected' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not connected'));

      await userEvent.type(
        screen.getByPlaceholderText(/Enter your GHL/),
        'my-api-key-abc123',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith(
          '/api/integrations',
          expect.objectContaining({ ghlApiKey: 'my-api-key-abc123' }),
        );
      });
    });

    it('shows success toast and updates status after a successful save', async () => {
      mockApi.put.mockResolvedValue({
        data: makeSettings({ ghlApiKey: '••••••••••••abc123', ghlConnectionStatus: 'connected' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not connected'));

      await userEvent.type(screen.getByPlaceholderText(/Enter your GHL/), 'valid-key-abc123');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Integration saved')).toBeInTheDocument();
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('shows backend error message when save fails', async () => {
      mockApi.put.mockRejectedValue({
        response: { data: { message: 'Could not connect to GoHighLevel. Please check your API key.' } },
      });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not connected'));

      await userEvent.type(screen.getByPlaceholderText(/Enter your GHL/), 'bad-key-abc123');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(
          screen.getByText('Could not connect to GoHighLevel. Please check your API key.'),
        ).toBeInTheDocument();
      });
    });

    it('shows generic error when save fails without a response body', async () => {
      mockApi.put.mockRejectedValue(new Error('Network error'));
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not connected'));

      await userEvent.type(screen.getByPlaceholderText(/Enter your GHL/), 'my-key-abc123');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to save settings.')).toBeInTheDocument();
      });
    });

    it('includes webhookUrl in the request body when provided', async () => {
      mockApi.put.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not connected'));

      await userEvent.type(screen.getByPlaceholderText(/Enter your GHL/), 'my-api-key');
      await userEvent.type(
        screen.getByPlaceholderText(/https:\/\/your-domain/),
        'https://example.com/hook',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith(
          '/api/integrations',
          expect.objectContaining({
            ghlApiKey: 'my-api-key',
            webhookUrl: 'https://example.com/hook',
          }),
        );
      });
    });
  });

  // ─── Test Connection ───────────────────────────────────────────────────────

  describe('Test Connection', () => {
    it('is not shown when no key is stored', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not connected'));
      expect(screen.queryByRole('button', { name: 'Test Connection' })).not.toBeInTheDocument();
    });

    it('is shown when a key is stored', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      render(<IntegrationsSettings />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Test Connection' })).toBeInTheDocument();
      });
    });

    it('shows "Testing…" label while in progress', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      mockApi.post.mockReturnValue(new Promise(() => {}));
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Test Connection' }));

      fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

      expect(screen.getByRole('button', { name: 'Testing…' })).toBeInTheDocument();
    });

    it('shows success toast when connection test passes', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      mockApi.post.mockResolvedValue({ data: { connected: true } });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Test Connection' }));

      fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(screen.getByText('Connection successful')).toBeInTheDocument();
      });
    });

    it('shows error toast when connection test returns false', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      mockApi.post.mockResolvedValue({ data: { connected: false } });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Test Connection' }));

      fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(
          screen.getByText('Connection failed — check your API key'),
        ).toBeInTheDocument();
      });
    });

    it('shows server error toast when the request throws', async () => {
      mockApi.get.mockResolvedValue({
        data: makeSettings({ ghlConnectionStatus: 'connected', ghlApiKey: '••••••••••••abc123' }),
      });
      mockApi.post.mockRejectedValue(new Error('Network error'));
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Test Connection' }));

      fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

      await waitFor(() => {
        expect(screen.getByText('Could not reach the server')).toBeInTheDocument();
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

    it('is not shown when no key is stored', async () => {
      mockApi.get.mockResolvedValue({ data: makeSettings() });
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByText('Not connected'));
      expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
    });

    it('opens a modal when Disconnect is clicked', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Remove integration?')).toBeInTheDocument();
      expect(
        screen.getByText('Are you sure? This will stop all AI booking services. You can reconnect at any time.'),
      ).toBeInTheDocument();
    });

    it('closes the modal when Cancel is clicked', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('closes the modal when the backdrop is clicked', async () => {
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      // The backdrop is the first child of the overlay (role="dialog")
      const backdrop = screen.getByRole('dialog').firstElementChild as HTMLElement;
      fireEvent.click(backdrop);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls POST /api/integrations/disconnect and shows success toast', async () => {
      mockApi.post.mockResolvedValue({});
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/api/integrations/disconnect');
        expect(screen.getByText('Integration disconnected')).toBeInTheDocument();
      });
    });

    it('updates status to "Not connected" after successful disconnect', async () => {
      mockApi.post.mockResolvedValue({});
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

      await waitFor(() => {
        expect(screen.getByText('Not connected')).toBeInTheDocument();
      });
    });

    it('shows error toast when disconnect fails', async () => {
      mockApi.post.mockRejectedValue(new Error('Server error'));
      render(<IntegrationsSettings />);
      await waitFor(() => screen.getByRole('button', { name: 'Disconnect' }));

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to disconnect')).toBeInTheDocument();
      });
    });
  });
});