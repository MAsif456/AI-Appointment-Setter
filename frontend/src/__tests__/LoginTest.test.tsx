// src/__tests__/LoginTest.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import { AuthProvider } from '@/contexts/AuthContext';
import api from '@/lib/apiAxios';

// Mock Axios
jest.mock('@/lib/apiAxios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

// Mock Next.js navigation properly
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',         // MOCK usePathname
  useSearchParams: () => ({ get: () => null }), // MOCK useSearchParams if used
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('calls login function on submit', async () => {
    const fakeUser = {
      _id: '1',
      name: 'Admin',
      email: 'admin@lunaxdigital.com',
      role: 'admin',
    };
    const fakeToken = 'fake-token';

    mockedApi.post.mockResolvedValue({ data: { user: fakeUser, accessToken: fakeToken } });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@lunaxdigital.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(localStorage.getItem('accessToken')).toBe(fakeToken);
      expect(localStorage.getItem('user')).toContain('Admin');
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message when login fails', async () => {
    mockedApi.post.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'wrong@user.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
    });
  });
});