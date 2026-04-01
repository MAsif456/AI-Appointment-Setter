import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockPush = jest.fn();
const mockPathname = { value: '/' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname.value,
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockPathname.value = '/';
  });

  // Login stores user with assignedClinics and isAdmin
  describe('login', () => {
    it('stores accessToken, user, and assignedClinics in localStorage', async () => {
      const fakeUser = {
        _id: '1', name: 'Admin', email: 'admin@test.com',
        role: 'admin', assignedClinics: [],
      };
      (api as jest.Mocked<typeof api>).post.mockResolvedValue({
        data: { user: fakeUser, accessToken: 'tok123' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      await act(async () => { await result.current.login('admin@test.com', 'pass'); });

      expect(localStorage.getItem('accessToken')).toBe('tok123');
      expect(JSON.parse(localStorage.getItem('user')!).name).toBe('Admin');
      expect(result.current.user).toEqual(fakeUser);
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('exposes isAdmin as true for admin role', async () => {
      (api as jest.Mocked<typeof api>).post.mockResolvedValue({
        data: { user: { _id: '1', name: 'A', email: 'a@b.com', role: 'admin', assignedClinics: [] }, accessToken: 'tok' },
      });
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      await act(async () => { await result.current.login('a@b.com', 'pass'); });

      expect(result.current.isAdmin).toBe(true);
    });

    it('exposes isAdmin as false for staff role', async () => {
      (api as jest.Mocked<typeof api>).post.mockResolvedValue({
        data: {
          user: { _id: '2', name: 'S', email: 's@b.com', role: 'staff', assignedClinics: ['clinic1'] },
          accessToken: 'tok',
        },
      });
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      await act(async () => { await result.current.login('s@b.com', 'pass'); });

      expect(result.current.isAdmin).toBe(false);
    });

    it('stores assignedClinics on the user object', async () => {
      const clinics = ['clinic_abc', 'clinic_def'];
      (api as jest.Mocked<typeof api>).post.mockResolvedValue({
        data: { user: { _id: '2', name: 'S', email: 's@b.com', role: 'staff', assignedClinics: clinics }, accessToken: 'tok' },
      });
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      await act(async () => { await result.current.login('s@b.com', 'pass'); });

      expect(result.current.user?.assignedClinics).toEqual(clinics);
    });
  });

  // Logout clears everything
  describe('logout', () => {
    it('clears localStorage, nulls user, and redirects to /login', () => {
      localStorage.setItem('accessToken', 'tok');
      localStorage.setItem('user', JSON.stringify({ name: 'Admin', role: 'admin' }));

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      act(() => { result.current.logout(); });

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(result.current.user).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  // Multi-tab logout via storage event
  describe('multi-tab logout', () => {
    it('clears user and redirects when accessToken is removed in another tab', () => {
      localStorage.setItem('accessToken', 'tok');
      localStorage.setItem('user', JSON.stringify({ name: 'Admin', role: 'admin' }));

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      // Simulate another tab removing the token
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'accessToken',
          newValue: null,
          oldValue: 'tok',
        }));
      });

      expect(result.current.user).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('updates user when another tab updates the user object', () => {
      const updatedUser = { _id: '1', name: 'Updated Name', email: 'a@b.com', role: 'admin' };

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'user',
          newValue: JSON.stringify(updatedUser),
        }));
      });

      expect(result.current.user?.name).toBe('Updated Name');
    });
  });

  // Loading user from localStorage on mount
  describe('initial load from localStorage', () => {
    it('restores user from localStorage on mount', () => {
      const savedUser = { _id: '1', name: 'Saved', email: 'saved@test.com', role: 'staff', assignedClinics: [] };
      localStorage.setItem('accessToken', 'tok');
      localStorage.setItem('user', JSON.stringify(savedUser));

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      expect(result.current.user?.name).toBe('Saved');
    });

    it('clears localStorage and leaves user null if stored JSON is malformed', () => {
      localStorage.setItem('accessToken', 'tok');
      localStorage.setItem('user', 'not-valid-json{{');

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });
});