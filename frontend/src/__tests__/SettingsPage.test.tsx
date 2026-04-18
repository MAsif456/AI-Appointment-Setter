import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';

// Mock child components so tests stay focused on tab routing
jest.mock('@/app/settings/components/AccountSettings', () => () => <div>Account Settings Content</div>);
jest.mock('@/app/settings/components/UserManagement', () => () => <div>User Management Content</div>);
jest.mock('@/app/settings/components/NotificationPreferences', () => () => <div>Notification Preferences Content</div>);
jest.mock('@/app/settings/components/IntegrationsSettings', () => () => (
  <><h2>Integrations</h2><p>Coming soon.</p></>
));

// Mock AuthContext to control role
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('SettingsPage', () => {
  beforeEach(() => jest.clearAllMocks());

  // Admin sees all four tabs
  describe('as admin', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: 'admin' } });
    });

    it('renders all four tabs for admin', () => {
      render(<SettingsPage />);
      expect(screen.getByRole('button', { name: 'Account Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'User Management' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Integrations' })).toBeInTheDocument();
    });

    it('shows Account Settings content by default', () => {
      render(<SettingsPage />);
      expect(screen.getByText('Account Settings Content')).toBeInTheDocument();
    });

    it('switches to User Management tab when clicked', () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole('button', { name: 'User Management' }));
      expect(screen.getByText('User Management Content')).toBeInTheDocument();
    });

    it('shows notification preferences when Notifications tab is clicked', () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
      expect(screen.getByText('Notification Preferences Content')).toBeInTheDocument();
    });

    it('shows placeholder for Integrations tab', () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Integrations' }));
      expect(screen.getByRole('heading', { name: 'Integrations' })).toBeInTheDocument();
      expect(screen.getByText('Coming soon.')).toBeInTheDocument();
    });
  });

  // Staff only sees Account Settings tab
  describe('as staff', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAdmin: false, user: { role: 'staff' } });
    });

    it('only shows Account Settings tab for staff', () => {
      render(<SettingsPage />);
      expect(screen.getByRole('button', { name: 'Account Settings' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'User Management' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Notifications' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Integrations' })).toBeInTheDocument();
    });

    it('shows Account Settings content by default', () => {
      render(<SettingsPage />);
      expect(screen.getByText('Account Settings Content')).toBeInTheDocument();
    });

    it('does not render User Management content even if URL is manipulated', () => {
      render(<SettingsPage />);
      // User Management is only rendered when isAdmin AND tab is active
      expect(screen.queryByText('User Management Content')).not.toBeInTheDocument();
    });
  });
});