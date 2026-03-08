// src/__tests__/AuthContext.test.tsx
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import api from '@/lib/apiAxios';

jest.mock('@/lib/api', () => ({
  post: jest.fn(),
}));

// Mock Next.js navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
  useSearchParams: () => ({ get: () => null }),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('login stores user and token in localStorage', async () => {
    const fakeUser = { _id: '1', name: 'Admin', email: 'admin@lunaxdigital.com', role: 'admin' };
    const fakeToken = 'fake-token';

    (api.post as jest.Mock).mockResolvedValue({ data: { user: fakeUser, accessToken: fakeToken } });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.login('admin@lunaxdigital.com', 'admin123');
    });

    expect(localStorage.getItem('accessToken')).toBe(fakeToken);
    expect(localStorage.getItem('user')).toContain('Admin');
    expect(result.current.user).toEqual(fakeUser);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('logout clears user and token', async () => {
    localStorage.setItem('accessToken', 'fake-token');
    localStorage.setItem('user', JSON.stringify({ name: 'Admin' }));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});