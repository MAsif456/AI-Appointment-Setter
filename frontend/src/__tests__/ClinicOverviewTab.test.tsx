/**
 * Unit tests for the ClinicOverviewTab component.
 * Verifies the four stat cards, clinic information panel, recent
 * conversations, loading/error states, and data-fetching behaviour.
 */
import { render, screen, waitFor } from '@testing-library/react';
import ClinicOverviewTab from '@/components/clinics/ClinicOverviewTab';
import type { Clinic } from '@/types/clinic';

// Mock the analytics and dashboard API helpers
jest.mock('@/lib/api/analytics', () => ({
  fetchClinicAnalytics: jest.fn(),
}));
jest.mock('@/lib/api/dashboard', () => ({
  fetchRecentConversations: jest.fn(),
}));

// Suppress Next.js Link / router warnings
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchClinicAnalytics } = require('@/lib/api/analytics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchRecentConversations } = require('@/lib/api/dashboard');

const mockClinic: Clinic = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Cardiff Physiotherapy Centre',
  ghlLocationId: 'loc_001',
  ghlCalendarId: 'cal_001',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  phone: '029 2034 5678',
  serviceAreas: [
    { postcodePrefix: 'CF' },
    { postcodePrefix: 'NP' },
  ],
  services: [
    { name: 'Back pain', durationMinutes: 30 },
    { name: 'Sports injury', durationMinutes: 45 },
  ],
  businessHours: [
    { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'tuesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    { day: 'sunday', isOpen: false },
  ],
  todayLeadsCount: 12,
  todayBookingsCount: 5,
  monthLeadsCount: 245,
  monthBookingsCount: 103,
  isActive: true,
  defaultAppointmentDuration: 30,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockAnalytics = {
  leads: 245,
  bookings: 103,
  conversionRate: 42,
  avgMessagesToBooking: 8,
  bookingsOverTime: [],
  funnel: { leads: 245, qualified: 180, bookingStarted: 140, booked: 103 },
  conversationPhaseDistribution: [],
  leadSources: [],
  declineRate: 5,
};

const mockConversations = [
  {
    _id: 'conv1',
    phase: 'confirmed',
    lastMessageAt: new Date().toISOString(),
    clinicId: { _id: mockClinic._id, name: mockClinic.name },
    leadId: { _id: 'l1', firstName: 'Sarah', lastName: 'Williams' },
  },
];

describe('ClinicOverviewTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchClinicAnalytics.mockResolvedValue(mockAnalytics);
    fetchRecentConversations.mockResolvedValue(mockConversations);
  });

  it('should show loading state initially', () => {
    fetchClinicAnalytics.mockReturnValue(new Promise(() => {}));
    fetchRecentConversations.mockReturnValue(new Promise(() => {}));

    render(<ClinicOverviewTab clinic={mockClinic} />);
    expect(screen.getByText('Loading overview...')).toBeInTheDocument();
  });

  it('should render four stat cards after loading', async () => {
    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(screen.getByText("This Month's Leads")).toBeInTheDocument();
    });
    expect(screen.getByText("This Month's Bookings")).toBeInTheDocument();
    expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Messages to Booking')).toBeInTheDocument();
  });

  it('should display correct analytics values', async () => {
    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(screen.getByText(/245/)).toBeInTheDocument();
    });
    expect(screen.getByText(/103/)).toBeInTheDocument();
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it('should render clinic information section', async () => {
    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(screen.getByText('Clinic Information')).toBeInTheDocument();
    });

    expect(screen.getByText('123 Queen Street, Cardiff, CF10 2BX')).toBeInTheDocument();
    expect(screen.getByText('029 2034 5678')).toBeInTheDocument();
  });

  it('should render service area pills', async () => {
    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(screen.getByText('CF')).toBeInTheDocument();
    });
    expect(screen.getByText('NP')).toBeInTheDocument();
  });

  it('should render services offered pills', async () => {
    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(screen.getByText('Back pain')).toBeInTheDocument();
    });
    expect(screen.getByText('Sports injury')).toBeInTheDocument();
  });

  it('should render business hours grid', async () => {
    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(screen.getByText('Monday')).toBeInTheDocument();
    });

    // Multiple days share the same hours so we expect multiple matches
    expect(screen.getAllByText('09:00 - 17:00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sunday')).toBeInTheDocument();
  });

  it('should render recent conversations', async () => {
    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Conversations')).toBeInTheDocument();
    });

    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
  });

  it('should show error state when fetching fails', async () => {
    fetchClinicAnalytics.mockRejectedValue(new Error('API failure'));

    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('API failure');
    });
  });

  it('should fetch data with the clinic id', async () => {
    render(<ClinicOverviewTab clinic={mockClinic} />);

    await waitFor(() => {
      expect(fetchClinicAnalytics).toHaveBeenCalledWith(
        mockClinic._id,
        expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }),
      );
    });

    expect(fetchRecentConversations).toHaveBeenCalledWith(3, mockClinic._id);
  });
});
