import { render, screen, waitFor } from '@testing-library/react';
import ClinicDetailPage from '../app/clinics/[id]/page';
import * as api from '@/lib/api/clinics';
import { Clinic } from '@/types/clinic';

// Mock the API module
jest.mock('@/lib/api/clinics');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock next/link as a simple anchor
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock next/navigation – useParams returns a clinic id, useSearchParams returns no edit flag
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '507f1f77bcf86cd799439011' }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock ClinicDetailTabs to keep the page test focused on page-level behaviour
jest.mock('@/components/clinics/ClinicDetailTabs', () => ({
  __esModule: true,
  default: require('react').forwardRef(function MockClinicDetailTabs() {
    return <div data-testid="clinic-detail-tabs" />;
  }),
}));

/** Factory for a sample clinic matching the seed data shape. */
const makeClinic = (overrides: Partial<Clinic> = {}): Clinic => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Cardiff Physiotherapy Centre',
  ghlLocationId: 'loc_cardiff_001',
  ghlCalendarId: 'cal_cardiff_001',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  serviceAreas: [{ postcodePrefix: 'CF' }, { postcodePrefix: 'NP' }],
  businessHours: [{ day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' }],
  todayLeadsCount: 12,
  todayBookingsCount: 5,
  monthLeadsCount: 245,
  monthBookingsCount: 103,
  defaultAppointmentDuration: 30,
  isActive: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

describe('ClinicDetailPage', () => {
  afterEach(() => jest.clearAllMocks());

  /** Verifies the loading state is shown while fetching. */
  it('shows loading text initially', () => {
    mockedApi.getClinicById.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ClinicDetailPage />);
    expect(screen.getByText('Loading clinic...')).toBeInTheDocument();
  });

  /** Verifies clinic details render after a successful fetch. */
  it('renders clinic name and active badge on success', async () => {
    mockedApi.getClinicById.mockResolvedValue(makeClinic());

    render(<ClinicDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Cardiff Physiotherapy Centre')).toBeInTheDocument();
    });
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('← Back to Clinics')).toBeInTheDocument();
  });

  /** Verifies the inactive badge is shown for deactivated clinics. */
  it('renders "Inactive" badge for an inactive clinic', async () => {
    mockedApi.getClinicById.mockResolvedValue(makeClinic({ isActive: false }));

    render(<ClinicDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  /** Verifies not-found state when the API returns an error. */
  it('shows "Clinic not found" when fetch fails', async () => {
    mockedApi.getClinicById.mockRejectedValue(new Error('Not found'));

    render(<ClinicDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Clinic not found.')).toBeInTheDocument();
    });
    expect(screen.getByText('Back to Clinics')).toBeInTheDocument();
  });

  /** Verifies the back link points to /clinics. */
  it('has a back link to the clinics list', async () => {
    mockedApi.getClinicById.mockResolvedValue(makeClinic());

    render(<ClinicDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('← Back to Clinics')).toBeInTheDocument();
    });

    const link = screen.getByText('← Back to Clinics').closest('a');
    expect(link).toHaveAttribute('href', '/clinics');
  });
});