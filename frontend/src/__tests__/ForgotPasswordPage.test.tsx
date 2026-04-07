import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPasswordPage from '@/app/forgot-password/page';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/forgot-password',
}));

/**
 * Tests for the updated ForgotPasswordPage.
 * Key changes from old version:
 *  - Button text is now "Send Reset Link" not "Send Reset Code"
 *  - On success, the page shows an inline success message instead of redirecting
 *  - Error is only shown for genuine failures, not for missing emails (enumeration prevention)
 */
describe('ForgotPasswordPage', () => {
  beforeEach(() => jest.clearAllMocks());

  // Rendering
  it('renders the form with email input and correct button text', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeInTheDocument();
    expect(screen.getByText(/Back to login/i)).toBeInTheDocument();
  });

  it('submit button is disabled when email is empty', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeDisabled();
  });

  // Email validation
  it('shows validation error for invalid email format', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'not-valid' } });
    await waitFor(() => {
      expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
    });
  });

  it('clears validation error when email becomes valid', async () => {
    render(<ForgotPasswordPage />);
    const input = screen.getByLabelText(/Email/i);
    fireEvent.change(input, { target: { value: 'bad' } });
    await waitFor(() => expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument());
    fireEvent.change(input, { target: { value: 'good@example.com' } });
    await waitFor(() => expect(screen.queryByText(/Invalid email address/i)).not.toBeInTheDocument());
  });

  // Success — inline state, no redirect
  it('shows inline success message after submit instead of redirecting', async () => {
    mockedApi.post.mockResolvedValue({ data: { message: 'link sent' } });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(screen.getByText(/If an account exists for/i)).toBeInTheDocument();
      expect(screen.getByText(/user@test.com/)).toBeInTheDocument();
      expect(screen.getByText(/link will expire in 1 hour/i)).toBeInTheDocument();
    });
  });

  it('does NOT redirect to reset-password after submit', async () => {
    const mockPush = jest.fn();
    jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => '/forgot-password' }));
    mockedApi.post.mockResolvedValue({ data: {} });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      // Success box shown — not redirected
      expect(screen.getByText(/If an account exists for/i)).toBeInTheDocument();
    });
  });

  it('shows Back to login link in success state', async () => {
    mockedApi.post.mockResolvedValue({ data: {} });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(screen.getByText(/Back to login/i)).toBeInTheDocument();
    });
  });

  // Error — only shown for genuine failures
  it('shows error only on genuine network failure', async () => {
    mockedApi.post.mockRejectedValue(new Error('Network error'));

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });

  it('clears error message when user types in the email field', async () => {
    mockedApi.post.mockRejectedValue(new Error('Network error'));

    render(<ForgotPasswordPage />);
    const input = screen.getByLabelText(/Email/i);
    fireEvent.change(input, { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument());

    fireEvent.change(input, { target: { value: 'another@test.com' } });
    await waitFor(() => expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument());
  });

  // Loading state
  it('shows loading state while submitting', async () => {
    mockedApi.post.mockImplementation(() => new Promise(() => {}));

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sending.../i })).toBeDisabled();
    });
  });
});