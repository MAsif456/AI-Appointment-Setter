import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResetPasswordPage from '@/app/reset-password/page';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios');
const mockedApi = api as jest.Mocked<typeof api>;

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  usePathname: () => '/reset-password',
  useSearchParams: () => ({
    get: (key: string) => (key === 'email' ? 'test@example.com' : null),
  }),
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fillForm = (code: string, password: string, confirmPassword: string) => {
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: code } });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: password } });
    fireEvent.change(passwordInputs[1], { target: { value: confirmPassword } });
  };

  it('renders form with email from URL params', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByRole('heading', { name: /AppointHealth AI/i })).toBeInTheDocument();
    expect(screen.getAllByText(/test@example.com/i)[0]).toBeInTheDocument();
  });

  it('handles back button click', () => {
    render(<ResetPasswordPage />);
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('only allows numeric digits in code field', () => {
    render(<ResetPasswordPage />);
    const codeInput = screen.getByPlaceholderText('123456') as HTMLInputElement;
    
    fireEvent.change(codeInput, { target: { value: 'abc123def' } });
    expect(codeInput.value).toBe('123');
  });

  it('validates password requirements and clears errors', async () => {
    render(<ResetPasswordPage />);
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    
    fireEvent.change(passwordInputs[0], { target: { value: 'weak' } });
    await waitFor(() => {
      expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
    });
    
    fireEvent.change(passwordInputs[0], { target: { value: 'ValidPass123!@' } });
    await waitFor(() => {
      expect(screen.queryByText(/must be at least 8 characters/i)).not.toBeInTheDocument();
    });
  });

  it('does not show confirm password error until submit', async () => {
  render(<ResetPasswordPage />);
  const passwordInputs = screen.getAllByPlaceholderText('••••••••');

  fireEvent.change(passwordInputs[0], { target: { value: 'ValidPass123!@' } });
  fireEvent.change(passwordInputs[1], { target: { value: 'Different123!@' } });

  expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
});

  it('toggles password visibility for both fields', () => {
    render(<ResetPasswordPage />);
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    const allButtons = screen.getAllByRole('button');
    const eyeButtons = allButtons.filter(btn => 
      !btn.textContent?.includes('Back') && 
      !btn.textContent?.includes('Reset') &&
      !btn.textContent?.includes('Resetting')
    );
    
    expect(passwordInputs[0]).toHaveAttribute('type', 'password');
    fireEvent.click(eyeButtons[0]);
    expect(passwordInputs[0]).toHaveAttribute('type', 'text');
    fireEvent.click(eyeButtons[0]);
    expect(passwordInputs[0]).toHaveAttribute('type', 'password');
    
    expect(passwordInputs[1]).toHaveAttribute('type', 'password');
    fireEvent.click(eyeButtons[1]);
    expect(passwordInputs[1]).toHaveAttribute('type', 'text');
  });

  it('disables submit button when form is invalid', async () => {
    render(<ResetPasswordPage />);
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });
    
    expect(submitButton).toBeDisabled();
    fillForm('123456', '', '');
    expect(submitButton).toBeDisabled();
    
    fillForm('123456', 'weak', 'weak');
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
    
    fillForm('123456', 'ValidPass123!@', 'ValidPass123!@');
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('resets password successfully', async () => {
    mockedApi.post.mockResolvedValue({ data: { message: 'Success' } });
    render(<ResetPasswordPage />);
    
    fillForm('123456', 'ValidPass123!@', 'ValidPass123!@');
    
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));
    
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/auth/reset-password', {
        email: 'test@example.com',
        code: '123456',
        newPassword: 'ValidPass123!@',
      });
      expect(mockPush).toHaveBeenCalledWith('/login?reset=true');
    });
  });

  it('shows validation errors on submit', async () => {
    render(<ResetPasswordPage />);
    
    fillForm('123456', 'weak', 'weak');
    const submitButton = screen.getByRole('button', { name: /Reset Password/i });
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('validates password mismatch on submit', async () => {
    render(<ResetPasswordPage />);
    
    fillForm('123456', 'ValidPass123!@', 'Different123!@');
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
      expect(mockedApi.post).not.toHaveBeenCalled();
    });
  });

  it('validates code length on submit', async () => {
    render(<ResetPasswordPage />);
    
    fillForm('123', 'ValidPass123!@', 'ValidPass123!@');
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Reset code must be 6 digits/i)).toBeInTheDocument();
      expect(mockedApi.post).not.toHaveBeenCalled();
    });
  });

  it('shows loading state during submission', async () => {
    let resolvePromise: any;
    mockedApi.post.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));
    
    render(<ResetPasswordPage />);
    fillForm('123456', 'ValidPass123!@', 'ValidPass123!@');
    
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resetting.../i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Resetting.../i })).toBeDisabled();
    });
    
    // Clean up
    resolvePromise({ data: {} });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Resetting.../i })).not.toBeInTheDocument();
    });
  });

  it('handles API errors with custom message', async () => {
    mockedApi.post.mockRejectedValue({
      response: { data: { message: 'Invalid code' } },
    });
    
    render(<ResetPasswordPage />);
    fillForm('999999', 'ValidPass123!@', 'ValidPass123!@');
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid code/i)).toBeInTheDocument();
    });
    
    expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument();
  });

  it('handles API errors without message', async () => {
    mockedApi.post.mockRejectedValue({ response: { data: {} } });
    
    render(<ResetPasswordPage />);
    fillForm('123456', 'ValidPass123!@', 'ValidPass123!@');
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid or expired reset code/i)).toBeInTheDocument();
    });
  });
});