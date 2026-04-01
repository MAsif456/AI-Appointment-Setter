import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResetPasswordPage from '@/app/reset-password/page';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockToken: string | null = 'valid-reset-token';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  usePathname: () => '/reset-password',
  useSearchParams: () => ({ get: (key: string) => key === 'token' ? mockToken : null }),
}));

/**
 * Tests for the updated ResetPasswordPage.
 * Key changes from old version:
 *  - No code input field — token comes from URL query param
 *  - No email field — backend takes { token, newPassword }
 *  - Shows error if no token in URL
 *  - Form is only rendered when a valid token is present
 */
describe('ResetPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToken = 'valid-reset-token';
  });

  // Renders form when token is present
  it('renders the password form when a token is in the URL', () => {
    render(<ResetPasswordPage />);
    expect(screen.getAllByPlaceholderText('••••••••')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument();
  });

  it('shows error and hides form when no token in URL', () => {
    mockToken = null;
    render(<ResetPasswordPage />);
    expect(screen.getByText(/Invalid reset link/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('••••••••')).not.toBeInTheDocument();
  });

  // Password validation
  it('shows validation error for password not meeting requirements', async () => {
    render(<ResetPasswordPage />);
    const [newPasswordInput] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(newPasswordInput, { target: { value: 'weak' } });
    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('shows error when passwords do not match', async () => {
    render(<ResetPasswordPage />);
    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass1!' } });
    fireEvent.change(confirmInput, { target: { value: 'DifferentPass1!' } });
    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('submit button is disabled when form is invalid', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByRole('button', { name: /Reset Password/i })).toBeDisabled();
  });

  it('submit button is enabled when passwords match and meet requirements', async () => {
    render(<ResetPasswordPage />);
    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass1!' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass1!' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reset Password/i })).not.toBeDisabled();
    });
  });

  // Submission - sends token + newPassword, no email or code
  it('calls API with token from URL and new password', async () => {
    mockedApi.post.mockResolvedValue({ data: { message: 'Password reset' } });
    render(<ResetPasswordPage />);
    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass1!' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'valid-reset-token',
        newPassword: 'ValidPass1!',
      });
    });
  });

  it('does NOT send email or code in the request body', async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<ResetPasswordPage />);
    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass1!' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      const callBody = (mockedApi.post as jest.Mock).mock.calls[0][1];
      expect(callBody).not.toHaveProperty('email');
      expect(callBody).not.toHaveProperty('code');
    });
  });

  it('redirects to /login?reset=true on success', async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    render(<ResetPasswordPage />);
    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass1!' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login?reset=true'));
  });

  it('shows API error message on failure', async () => {
    mockedApi.post.mockRejectedValue({ response: { data: { message: 'Reset link is invalid or has expired.' } } });
    render(<ResetPasswordPage />);
    const [newPasswordInput, confirmInput] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass1!' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument());
  });

  // Back button
  it('calls router.back when Back button is clicked', () => {
    render(<ResetPasswordPage />);
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(mockPush).toHaveBeenCalledWith('/forgot-password');
  });

  // Password visibility toggle
  it('toggles password visibility', () => {
    render(<ResetPasswordPage />);
    const [firstInput] = screen.getAllByPlaceholderText('••••••••');
    expect(firstInput).toHaveAttribute('type', 'password');
    const eyeButtons = screen.getAllByRole('button').filter(b => !b.textContent?.includes('Back') && !b.textContent?.includes('Reset'));
    fireEvent.click(eyeButtons[0]);
    expect(firstInput).toHaveAttribute('type', 'text');
  });
});