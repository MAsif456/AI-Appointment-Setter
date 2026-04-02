import { render, screen, waitFor } from '@testing-library/react';
import ClinicDetailPage from '@/app/clinics/[id]/page';
import * as clinicsApi from '@/lib/api/clinics';
import { Clinic } from '@/types/clinic';

jest.mock('@/lib/api/clinics');
const mockedApi = clinicsApi as jest.Mocked<typeof clinicsApi>;

jest.mock('next/link', () => ({ children, href }: any) => <a href={href}>{children}</a>);

const mockReplace = jest.fn();
const mockUseAuth = jest.fn();

// Mock next/navigation – useParams returns a clinic id, useSearchParams returns no edit flag
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'clinic_abc' }),
  useSearchParams: () => ({ get: () => null }),
    useRouter: () => ({ replace: mockReplace }),
}));

// Mock ClinicDetailTabs to keep the page test focused on page-level behaviour
jest.mock('@/components/clinics/ClinicDetailTabs', () => ({
  __esModule: true,
  default: require('react').forwardRef(function MockClinicDetailTabs() {
    return <div data-testid="clinic-detail-tabs" />;
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Stub ClinicDetailTabs to keep test output clean
jest.mock('@/components/clinics/ClinicDetailTabs', () => () => <div>Clinic Tabs</div>);

function makeClinic(overrides: Partial<Clinic> = {}): Clinic {
  return {
    _id: 'clinic_abc', name: 'Cardiff Physio', ghlLocationId: 'loc_1', ghlCalendarId: 'cal_1',
    address: '1 Queen St', serviceAreas: [], businessHours: [],
    todayLeadsCount: 0, todayBookingsCount: 0, monthLeadsCount: 0, monthBookingsCount: 0,
    defaultAppointmentDuration: 30, isActive: true, createdAt: '', updatedAt: '', ...overrides,
  };
}

/**
 * Tests for the updated ClinicDetailPage.
 * New behaviour: staff are redirected away if the clinic is not in their assignedClinics.
 */
describe('ClinicDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Admin access
  describe('as admin', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: 'admin', assignedClinics: [] } });
    });

    it('fetches and renders clinic details', async () => {
      mockedApi.getClinicById.mockResolvedValue(makeClinic());
      render(<ClinicDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Cardiff Physio')).toBeInTheDocument();
      });
    });

    it('shows Active badge for an active clinic', async () => {
      mockedApi.getClinicById.mockResolvedValue(makeClinic({ isActive: true }));
      render(<ClinicDetailPage />);
      await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    });

    it('shows Inactive badge for a deactivated clinic', async () => {
      mockedApi.getClinicById.mockResolvedValue(makeClinic({ isActive: false }));
      render(<ClinicDetailPage />);
      await waitFor(() => expect(screen.getByText('Inactive')).toBeInTheDocument());
    });

    it('does NOT redirect for admin even when assignedClinics is empty', async () => {
      mockedApi.getClinicById.mockResolvedValue(makeClinic());
      render(<ClinicDetailPage />);
      await waitFor(() => expect(screen.getByText('Cardiff Physio')).toBeInTheDocument());
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // Staff access control
  describe('as staff', () => {
    it('redirects to /clinics when clinic is NOT in assignedClinics', async () => {
      mockUseAuth.mockReturnValue({
        isAdmin: false,
        user: { role: 'staff', assignedClinics: ['other_clinic_id'] },
      });
      render(<ClinicDetailPage />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/clinics');
      });
      expect(mockedApi.getClinicById).not.toHaveBeenCalled();
    });

    it('renders clinic when it IS in assignedClinics', async () => {
      mockUseAuth.mockReturnValue({
        isAdmin: false,
        user: { role: 'staff', assignedClinics: ['clinic_abc'] },
      });
      mockedApi.getClinicById.mockResolvedValue(makeClinic());
      render(<ClinicDetailPage />);
      await waitFor(() => expect(screen.getByText('Cardiff Physio')).toBeInTheDocument());
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // Error states
  it('shows not found state when API returns an error', async () => {
    mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: 'admin', assignedClinics: [] } });
    mockedApi.getClinicById.mockRejectedValue(new Error('Not found'));
    render(<ClinicDetailPage />);
    await waitFor(() => expect(screen.getByText('Clinic not found.')).toBeInTheDocument());
  });

  it('shows loading text initially', () => {
    mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: 'admin', assignedClinics: [] } });
    mockedApi.getClinicById.mockReturnValue(new Promise(() => {}));
    render(<ClinicDetailPage />);
    expect(screen.getByText('Loading clinic...')).toBeInTheDocument();
  });
});