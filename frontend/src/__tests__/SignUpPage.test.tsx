import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignupPage from '@/app/signup/page';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios');
const mockedApi = api as jest.Mocked<typeof api>;

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/signup',
}));

describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates password requirements', async () => {
    render(<SignupPage />);

    const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
    fireEvent.change(passwordInput, { target: { value: 'weak' } });

    await waitFor(() => {
      expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('checks if passwords match', async () => {
    render(<SignupPage />);

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');

    fireEvent.change(passwordInputs[0], {
      target: { value: 'ValidPass123!@' },
    });

    fireEvent.change(passwordInputs[1], {
      target: { value: 'DifferentPass123!@' },
    });

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('submits form and redirects to verify-email', async () => {
    mockedApi.post.mockResolvedValue({ data: { email: 'test@example.com' } });

    render(<SignupPage />);

    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), {
      target: { value: 'test@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');

    fireEvent.change(passwordInputs[0], {
      target: { value: 'ValidPass123!@' },
    });

    fireEvent.change(passwordInputs[1], {
      target: { value: 'ValidPass123!@' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/verify-email?email=test%40example.com');
    });
  });

  it('displays backend error on registration failure', async () => {
    mockedApi.post.mockRejectedValue({
      response: { data: { message: 'Email is already in use' } },
    });

    render(<SignupPage />);

    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), {
      target: { value: 'test@example.com' },
    });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');

    fireEvent.change(passwordInputs[0], {
      target: { value: 'ValidPass123!@' },
    });

    fireEvent.change(passwordInputs[1], {
      target: { value: 'ValidPass123!@' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Email is already in use/i)).toBeInTheDocument();
    });
  });
});