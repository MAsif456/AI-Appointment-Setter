// src/__tests__/LoginTest.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import { AuthProvider } from '@/contexts/AuthContext';
import api from '@/lib/api';

// Mock API
jest.mock('@/lib/api', () => ({
  post: jest.fn(),
}));

// Create mocks for next/navigation
const mockPush = jest.fn();
const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
  useSearchParams: () => ({ get: mockGet }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockGet.mockReturnValue(null); // default to no expired param
  });

  it('renders email and password fields and submit button', () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('toggles password visibility when button is clicked', () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /show/i });

    expect(passwordInput.type).toBe('password');

    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');

    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });

  it('calls login function on submit', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: {
        user: { _id: '1', name: 'Admin', email: 'admin@lunaxdigital.com', role: 'admin' },
        accessToken: 'fake-token',
      },
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@lunaxdigital.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'admin123' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(localStorage.getItem('accessToken')).toBe('fake-token');
      expect(localStorage.getItem('user')).toContain('Admin');
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message when login fails', async () => {
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'wrong@user.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows session expired message if searchParams expired=true', () => {
    // Override mockGet to return 'true'
    mockGet.mockReturnValue('true');

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    expect(
      screen.getByText('Please log in again with your email and password.')
    ).toBeInTheDocument();
  });
});