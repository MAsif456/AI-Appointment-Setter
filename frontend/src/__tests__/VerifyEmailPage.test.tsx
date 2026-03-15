import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VerifyEmailPage from '@/app/verify-email/page';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios');
const mockedApi = api as jest.Mocked<typeof api>;

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/verify-email',
  useSearchParams: () => ({ get: (key: string) => (key === 'email' ? 'test@example.com' : null) }),
}));

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates code length', async () => {
    render(<VerifyEmailPage />);

    const codeInput = screen.getByPlaceholderText('123456');
    fireEvent.change(codeInput, { target: { value: '123' } });

    const submitButton = screen.getByRole('button', { name: /verify/i });
    expect(submitButton).toBeDisabled();
  });

  it('submits verification code and redirects to login', async () => {
    mockedApi.post.mockResolvedValue({ data: { message: 'Email verified' } });

    render(<VerifyEmailPage />);

    fireEvent.change(screen.getByPlaceholderText('123456'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?verified=true');
    });
  });

  it('shows error for invalid code', async () => {
    mockedApi.post.mockRejectedValue({
      response: { data: { message: 'Invalid or expired verification code' } },
    });

    render(<VerifyEmailPage />);

    fireEvent.change(screen.getByPlaceholderText('123456'), {
      target: { value: '999999' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid or expired/i)).toBeInTheDocument();
    });
  });

  it('resends verification code', async () => {
    mockedApi.post.mockResolvedValue({ data: { message: 'Code resent' } });

    render(<VerifyEmailPage />);

    fireEvent.click(screen.getByRole('button', { name: /resend code/i }));

    await waitFor(() => {
      expect(screen.getByText(/code resent/i)).toBeInTheDocument();
    });
  });
});