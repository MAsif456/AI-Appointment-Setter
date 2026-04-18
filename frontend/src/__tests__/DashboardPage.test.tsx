/**
 * Unit tests for the main Dashboard page.
 * Verifies stat cards, clinic performance table, recent conversations,
 * loading/error states, and navigation behaviour.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardPage from '@/app/page';

// Mock auth — defaults to an authenticated admin user
const mockUser = { _id: 'u1', name: 'Test Admin', email: 'admin@test.com', role: 'admin' as const };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Suppress Next.js Link warnings in test
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock the dashboard API layer
jest.mock('@/lib/api/dashboard', () => ({
  fetchDashboardOverview: jest.fn(),
  fetchDashboardClinics: jest.fn(),
  fetchRecentConversations: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchDashboardOverview, fetchDashboardClinics, fetchRecentConversations } = require('@/lib/api/dashboard');

const mockOverview = {
  totalLeads: 35,
  totalBookings: 15,
  conversionRate: 43,
  avgMessagesToBooking: 8,
  comparison: {
    leadsChange: 12,
    bookingsChange: 8,
    conversionRateChange: -3,
    avgMessagesToBookingChange: 0,
  },
  bookingsOverTime: [],
  conversionFunnel: { leads: 35, qualified: 20, bookingStarted: 18, booked: 15 },
};

const mockClinics = [
  { clinicId: 'c1', clinicName: 'Cardiff Physiotherapy Centre', leads: 12, bookings: 5, conversionRate: 42, avgMessages: 7, declineRate: 8 },
  { clinicId: 'c2', clinicName: 'Newport Sports Clinic', leads: 8, bookings: 3, conversionRate: 38, avgMessages: 6, declineRate: 10 },
];

const mockConversations = [
  {
    _id: 'conv1',
    phase: 'confirmed',
    lastMessageAt: new Date(Date.now() - 86400000).toISOString(),
    clinicId: { _id: 'c1', name: 'Cardiff Physiotherapy Centre' },
    leadId: { _id: 'l1', firstName: 'Sarah', lastName: 'Williams' },
  },
  {
    _id: 'conv2',
    phase: 'booking',
    lastMessageAt: new Date(Date.now() - 172800000).toISOString(),
    clinicId: { _id: 'c2', name: 'Newport Sports Clinic' },
    leadId: { _id: 'l2', firstName: 'John', lastName: 'Davies' },
  },
];

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchDashboardOverview.mockResolvedValue(mockOverview);
    fetchDashboardClinics.mockResolvedValue(mockClinics);
    fetchRecentConversations.mockResolvedValue(mockConversations);
  });

  it('should show loading state initially', () => {
    fetchDashboardOverview.mockReturnValue(new Promise(() => {}));
    fetchDashboardClinics.mockReturnValue(new Promise(() => {}));
    fetchRecentConversations.mockReturnValue(new Promise(() => {}));

    render(<DashboardPage />);

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('should render the page header with greeting and user name', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText(/Test Admin/)).toBeInTheDocument();
  });

  it('should render all four stat cards after loading', async () => {
    render(<DashboardPage />);

    // "Today's Leads" appears as both a stat card title and a table header
    // so we verify at least two matches exist (card + table column).
    await waitFor(() => {
      expect(screen.getAllByText("Today's Leads").length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getAllByText("Today's Bookings").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Conversion Rate').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Avg Messages to Booking')).toBeInTheDocument();
  });

  it('should display the correct stat values', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/35/)).toBeInTheDocument();
    });

    expect(screen.getByText(/15/)).toBeInTheDocument();
    expect(screen.getByText(/43%/)).toBeInTheDocument();
  });

  it('should show delta labels with vs yesterday', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('+12% vs yesterday')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('+8% vs yesterday')).toBeInTheDocument();
    expect(screen.getByLabelText('-3% vs yesterday')).toBeInTheDocument();
    expect(screen.getByLabelText('0% vs yesterday')).toBeInTheDocument();
  });

  it('should render the clinic performance table', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Clinic Performance')).toBeInTheDocument();
    });

    // Clinic names appear in both the table and the recent-conversations list
    expect(screen.getAllByText('Cardiff Physiotherapy Centre').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Newport Sports Clinic').length).toBeGreaterThanOrEqual(1);
  });

  it('should navigate to clinic detail when a row is clicked', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Clinic Performance')).toBeInTheDocument();
    });

    // Use the aria-label set on the row for unambiguous targeting
    const row = screen.getByLabelText('View details for Cardiff Physiotherapy Centre');
    fireEvent.click(row);
    expect(mockPush).toHaveBeenCalledWith('/clinics/c1');
  });

  it('should render recent conversations', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Conversations')).toBeInTheDocument();
    });

    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    expect(screen.getByText('John Davies')).toBeInTheDocument();
  });

  it('should show a View all link to the conversations page', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('View all')).toBeInTheDocument();
    });

    expect(screen.getByText('View all').closest('a')).toHaveAttribute('href', '/conversations');
  });

  it('should show an error message when fetching fails', async () => {
    fetchDashboardOverview.mockRejectedValue(new Error('Server error'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });

  it('should show empty clinic table when no clinics returned', async () => {
    fetchDashboardClinics.mockResolvedValue([]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No clinic data available yet.')).toBeInTheDocument();
    });
  });

  it('should show empty state when no recent conversations', async () => {
    fetchRecentConversations.mockResolvedValue([]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No recent conversations.')).toBeInTheDocument();
    });
  });
});
