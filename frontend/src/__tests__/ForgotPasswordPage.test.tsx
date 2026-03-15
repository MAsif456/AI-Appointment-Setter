import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPasswordPage from '@/app/forgot-password/page';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios');
const mockedApi = api as jest.Mocked<typeof api>;

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/forgot-password',
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the forgot password form', () => {
      render(<ForgotPasswordPage />);

      // Check for title (be more specific to avoid multiple matches)
      expect(screen.getByRole('heading', { name: /AppointHealth AI/i })).toBeInTheDocument();
      expect(screen.getByText(/Forgot password?/i)).toBeInTheDocument();
      expect(screen.getByText(/Enter your email and we'll send you a reset code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Reset Code/i })).toBeInTheDocument();
      expect(screen.getByText(/Back to login/i)).toBeInTheDocument();
    });

    it('should have email input with correct placeholder', () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
    });

    it('should have submit button initially disabled', () => {
      render(<ForgotPasswordPage />);

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Email Validation', () => {
    it('should show error for invalid email format', async () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      await waitFor(() => {
        expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
      });
    });

    it('should not show error for valid email', async () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      await waitFor(() => {
        expect(screen.queryByText(/Invalid email address/i)).not.toBeInTheDocument();
      });
    });

    it('should validate email on change', async () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      
      // Type invalid email
      fireEvent.change(emailInput, { target: { value: 'invalid' } });
      await waitFor(() => {
        expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
      });

      // Fix email
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      await waitFor(() => {
        expect(screen.queryByText(/Invalid email address/i)).not.toBeInTheDocument();
      });
    });

    it('should not show error when email is empty', () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: '' } });

      expect(screen.queryByText(/Invalid email address/i)).not.toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should disable button when email is empty', () => {
      render(<ForgotPasswordPage />);

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable button when email has validation error', async () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
        expect(submitButton).toBeDisabled();
      });
    });

    it('should enable button when email is valid', async () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should show loading state when submitting', async () => {
      mockedApi.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Sending.../i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sending.../i })).toBeDisabled();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid email and redirect', async () => {
      mockedApi.post.mockResolvedValue({ 
        data: { message: 'If the email exists, a reset code has been sent.' } 
      });

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith('/auth/forgot-password', {
          email: 'test@example.com',
        });
        expect(mockPush).toHaveBeenCalledWith('/reset-password?email=test%40example.com');
      });
    });

    it('should not submit with invalid email', async () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockedApi.post).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    it('should encode email in URL correctly', async () => {
      mockedApi.post.mockResolvedValue({ data: { message: 'Code sent' } });

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'user+test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/reset-password?email=user%2Btest%40example.com');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display backend error message', async () => {
      mockedApi.post.mockRejectedValue({
        response: { data: { message: 'Service temporarily unavailable' } },
      });

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Service temporarily unavailable/i)).toBeInTheDocument();
      });
    });

    it('should display generic error when no message provided', async () => {
      mockedApi.post.mockRejectedValue({
        response: { data: {} },
      });

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to send reset code/i)).toBeInTheDocument();
      });
    });

    it('should display generic error on network failure', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network error'));

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to send reset code/i)).toBeInTheDocument();
      });
    });

    it('should clear error when typing in email field', async () => {
      mockedApi.post.mockRejectedValue({
        response: { data: { message: 'Service error' } },
      });

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Service error/i)).toBeInTheDocument();
      });

      fireEvent.change(emailInput, { target: { value: 'test2@example.com' } });

      await waitFor(() => {
        expect(screen.queryByText(/Service error/i)).not.toBeInTheDocument();
      });
    });

    it('should stop loading after error', async () => {
      mockedApi.post.mockRejectedValue({
        response: { data: { message: 'Error' } },
      });

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Send Reset Code/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Sending.../i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should have back to login link', () => {
      render(<ForgotPasswordPage />);

      const backLink = screen.getByText(/Back to login/i);
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Email Input Behavior', () => {
    it('should update email state when typing', () => {
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i) as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'newemail@test.com' } });

      expect(emailInput.value).toBe('newemail@test.com');
    });

    it('should handle email input with whitespace', async () => {
      mockedApi.post.mockResolvedValue({ data: { message: 'Sent' } });

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      
      // HTML email inputs automatically trim whitespace
      fireEvent.change(emailInput, { target: { value: '  test@example.com  ' } });

      const submitButton = screen.getByRole('button', { name: /Send Reset Code/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Email inputs trim whitespace, so the submitted value will be trimmed
        expect(mockedApi.post).toHaveBeenCalledWith('/auth/forgot-password', {
          email: 'test@example.com',
        });
      });
    });
  });

  describe('Multiple submissions', () => {
    it('should handle multiple form submissions', async () => {
      mockedApi.post.mockResolvedValue({ data: { message: 'Sent' } });

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText(/admin@lunaxdigital.com/i);
      
      // First submission
      fireEvent.change(emailInput, { target: { value: 'test1@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /Send Reset Code/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/reset-password?email=test1%40example.com');
      });

      jest.clearAllMocks();

      // Second submission (if user goes back)
      fireEvent.change(emailInput, { target: { value: 'test2@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /Send Reset Code/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/reset-password?email=test2%40example.com');
      });
    });
  });
});