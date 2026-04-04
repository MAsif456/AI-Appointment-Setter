import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import VerifyEmailPage from '@/app/verify-email/page';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockPush = jest.fn();
let mockToken: string | null = 'valid-token-abc';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/verify-email',
  useSearchParams: () => ({ get: (key: string) => key === 'token' ? mockToken : null }),
}));

/**
 * Tests for the updated VerifyEmailPage.
 * The new flow auto-verifies on mount using the token from the URL —
 * there is no code entry form. The user just clicks the link in their email.
 */
describe('VerifyEmailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockToken = 'valid-token-abc';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Loading state
  it('shows loading spinner while verifying', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<VerifyEmailPage />);
    expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
  });

  // Success state
  it('shows success message and redirects after valid token', async () => {
    mockedApi.get.mockResolvedValue({ data: { message: 'Email verified' } });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Email verified successfully/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Redirecting you to login/i)).toBeInTheDocument();
  });

  it('redirects to /login?verified=true after 3 seconds on success', async () => {
    mockedApi.get.mockResolvedValue({ data: { message: 'Email verified' } });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Email verified successfully/i)).toBeInTheDocument();
    });

    act(() => { jest.advanceTimersByTime(3000); });

    expect(mockPush).toHaveBeenCalledWith('/login?verified=true');
  });

  it('calls GET /auth/verify-email with the token from the URL', async () => {
    mockedApi.get.mockResolvedValue({ data: {} });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/auth/verify-email?token=valid-token-abc');
    });
  });

  // Error states
  it('shows error when no token is in the URL', async () => {
    mockToken = null;
    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Invalid verification link/i)).toBeInTheDocument();
    });
  });

  it('shows error message from API when token is invalid', async () => {
    mockedApi.get.mockRejectedValue({
      response: { data: { message: 'Verification link is invalid or has expired.' } },
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    });
  });

  it('shows fallback error when API returns no message', async () => {
    mockedApi.get.mockRejectedValue({ response: { data: {} } });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Verification link is invalid or has expired. Please contact an admin/i)).toBeInTheDocument();
    });
  });

  it('shows Back to Login button in error state', async () => {
    mockToken = null;
    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Back to Login/i })).toBeInTheDocument();
    });
  });

  it('navigates to /login when Back to Login is clicked', async () => {
    mockToken = null;
    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Back to Login/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Back to Login/i }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});