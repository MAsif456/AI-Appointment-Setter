import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationPreferences from '@/app/settings/components/NotificationPreferences';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const DEFAULT_PREFS = {
  generalNotifications: true,
  emailNotifications: true,
  stalledConversations: true,
  escalatedConversations: true,
  appointmentReminders: true,
};

describe('NotificationPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Loading & error states ─────────────────────────────────────────────────

  it('shows loading state while fetching', async () => {
    mockedApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<NotificationPreferences />);
    expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
  });

  it('shows error message when GET request fails', async () => {
    mockedApi.get.mockRejectedValue(new Error('Network error'));
    render(<NotificationPreferences />);
    await waitFor(() =>
      expect(screen.getByText(/Failed to load notification preferences/)).toBeInTheDocument(),
    );
  });

  it('does not show stale or default data when API call fails', async () => {
    mockedApi.get.mockRejectedValue(new Error('Network error'));
    render(<NotificationPreferences />);
    await waitFor(() => expect(screen.queryByRole('switch')).not.toBeInTheDocument());
  });

  // ── Renders preferences from API ──────────────────────────────────────────

  it('renders all four toggles after successful load', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    render(<NotificationPreferences />);
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'General notifications' })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Email notifications' })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Stalled conversations' })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Appointment reminders' })).toBeInTheDocument();
    });
  });

  it('reflects saved preference state — emailNotifications false on load', async () => {
    mockedApi.get.mockResolvedValue({ data: { ...DEFAULT_PREFS, emailNotifications: false } });
    render(<NotificationPreferences />);
    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: 'Email notifications' });
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  // ── General notifications master switch ───────────────────────────────────

  it('disables individual toggles when general notifications is toggled off', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'General notifications' }));

    fireEvent.click(screen.getByRole('switch', { name: 'General notifications' }));

    const emailToggle = screen.getByRole('switch', { name: 'Email notifications' });
    expect(emailToggle).toBeDisabled();
  });

  it('re-enables individual toggles when general notifications is toggled back on', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'General notifications' }));

    // Turn off then on
    fireEvent.click(screen.getByRole('switch', { name: 'General notifications' }));
    fireEvent.click(screen.getByRole('switch', { name: 'General notifications' }));

    const emailToggle = screen.getByRole('switch', { name: 'Email notifications' });
    expect(emailToggle).not.toBeDisabled();
  });

  // ── Save Preferences ──────────────────────────────────────────────────────

  it('Save and Cancel buttons are disabled when no changes have been made', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByText('Save Preferences'));
    expect(screen.getByText('Save Preferences')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('enables Save and Cancel after a change is made', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'Email notifications' }));

    fireEvent.click(screen.getByRole('switch', { name: 'Email notifications' }));

    expect(screen.getByText('Save Preferences')).not.toBeDisabled();
    expect(screen.getByText('Cancel')).not.toBeDisabled();
  });

  it('sends PATCH with updated preferences on Save', async () => {
    const updated = { ...DEFAULT_PREFS, emailNotifications: false };
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    mockedApi.patch.mockResolvedValue({ data: updated });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'Email notifications' }));

    fireEvent.click(screen.getByRole('switch', { name: 'Email notifications' }));
    fireEvent.click(screen.getByText('Save Preferences'));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/users/me/notification-preferences',
        expect.objectContaining({ emailNotifications: false }),
      ),
    );
  });

  it('shows success toast after saving', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    mockedApi.patch.mockResolvedValue({ data: { ...DEFAULT_PREFS, emailNotifications: false } });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'Email notifications' }));

    fireEvent.click(screen.getByRole('switch', { name: 'Email notifications' }));
    fireEvent.click(screen.getByText('Save Preferences'));

    await waitFor(() =>
      expect(screen.getByText('Preferences saved successfully')).toBeInTheDocument(),
    );
  });

  it('shows error alert when PATCH fails', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    mockedApi.patch.mockRejectedValue(new Error('Server error'));
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'Email notifications' }));

    fireEvent.click(screen.getByRole('switch', { name: 'Email notifications' }));
    fireEvent.click(screen.getByText('Save Preferences'));

    await waitFor(() =>
      expect(screen.getByText(/Failed to save preferences/)).toBeInTheDocument(),
    );
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  it('reverts toggles to saved state on Cancel without making an API call', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'Email notifications' }));

    // Make a change
    fireEvent.click(screen.getByRole('switch', { name: 'Email notifications' }));
    expect(screen.getByRole('switch', { name: 'Email notifications' })).toHaveAttribute('aria-checked', 'false');

    // Cancel — should revert
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByRole('switch', { name: 'Email notifications' })).toHaveAttribute('aria-checked', 'true');

    // No PATCH should have been called
    expect(mockedApi.patch).not.toHaveBeenCalled();
  });

  it('does not call GET again on Cancel', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'Email notifications' }));

    fireEvent.click(screen.getByRole('switch', { name: 'Email notifications' }));
    fireEvent.click(screen.getByText('Cancel'));

    // GET called once on mount only
    expect(mockedApi.get).toHaveBeenCalledTimes(1);
  });

  // ── generalNotifications=false on save ────────────────────────────────────

  it('sends generalNotifications false when master switch is turned off and saved', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    mockedApi.patch.mockResolvedValue({ data: { ...DEFAULT_PREFS, generalNotifications: false } });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'General notifications' }));

    fireEvent.click(screen.getByRole('switch', { name: 'General notifications' }));
    fireEvent.click(screen.getByText('Save Preferences'));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/users/me/notification-preferences',
        expect.objectContaining({ generalNotifications: false }),
      ),
    );
  });

  // ── New user defaults ─────────────────────────────────────────────────────

  it('shows all toggles on when API returns all-true defaults', async () => {
    mockedApi.get.mockResolvedValue({ data: DEFAULT_PREFS });
    render(<NotificationPreferences />);
    await waitFor(() => screen.getByRole('switch', { name: 'General notifications' }));

    const switches = screen.getAllByRole('switch');
    switches.forEach(sw => expect(sw).toHaveAttribute('aria-checked', 'true'));
  });
});
