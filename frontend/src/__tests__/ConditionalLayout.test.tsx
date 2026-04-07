// __tests__/ConditionalLayout.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import ConditionalLayout from '@/app/layout';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock next/font/google
jest.mock('next/font/google', () => ({
  Inter: jest.fn(() => ({})),
}));

// Mock Next.js navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: jest.fn(),
}));

// Mock Sidebar
jest.mock('@/components/Sidebar/Sidebar', () => () => <div>Mock Sidebar</div>);

describe('ConditionalLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children without sidebar on login page', () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/login');

    render(
      <AuthProvider>
        <ConditionalLayout>
          <div>Child Content</div>
        </ConditionalLayout>
      </AuthProvider>
    );

    expect(screen.getByText('Child Content')).toBeInTheDocument();
    expect(screen.queryByText('Mock Sidebar')).not.toBeInTheDocument();
  });

  it('renders children with sidebar on dashboard page', () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/dashboard');

    render(
      <AuthProvider>
        <ConditionalLayout>
          <div>Dashboard Content</div>
        </ConditionalLayout>
      </AuthProvider>
    );

    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    expect(screen.getByText('Mock Sidebar')).toBeInTheDocument();
  });
});