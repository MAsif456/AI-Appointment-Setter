import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// Stub ClinicDetailTabs — exposes onTabChange so the page test can simulate tab switching
jest.mock('@/components/clinics/ClinicDetailTabs', () => {
  const { forwardRef } = require('react');
  return {
    __esModule: true,
    default: forwardRef(function MockClinicDetailTabs(props: any, _ref: any) {
      return (
        <div data-testid="clinic-detail-tabs">
          <button onClick={() => props.onTabChange?.('Settings')}>Switch to Settings</button>
          <button onClick={() => props.onTabChange?.('AI Configuration')}>Switch to AI Config</button>
          <button onClick={() => props.onTabChange?.('Overview')}>Switch to Overview</button>
          <button onClick={() => props.onTabChange?.('Conversations')}>Switch to Conversations</button>
        </div>
      );
    }),
  };
});

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

  // AC-12: Edit settings button visibility
  describe('edit settings button visibility (AC-12)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: 'admin', assignedClinics: [] } });
      mockedApi.getClinicById.mockResolvedValue(makeClinic());
    });

    it('does not show edit button on Overview tab by default', async () => {
      render(<ClinicDetailPage />);
      await waitFor(() => expect(screen.getByText('Cardiff Physio')).toBeInTheDocument());
      expect(screen.queryByText('Edit Settings')).not.toBeInTheDocument();
    });

    it('shows edit button when on Settings tab', async () => {
      render(<ClinicDetailPage />);
      await waitFor(() => expect(screen.getByText('Cardiff Physio')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Switch to Settings'));
      expect(screen.getByText('Edit Settings')).toBeInTheDocument();
    });

    it('shows edit button when on AI Configuration tab', async () => {
      render(<ClinicDetailPage />);
      await waitFor(() => expect(screen.getByText('Cardiff Physio')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Switch to AI Config'));
      expect(screen.getByText('Edit Settings')).toBeInTheDocument();
    });

    it('hides edit button when switching back to Conversations tab', async () => {
      render(<ClinicDetailPage />);
      await waitFor(() => expect(screen.getByText('Cardiff Physio')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Switch to Settings'));
      expect(screen.getByText('Edit Settings')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Switch to Conversations'));
      expect(screen.queryByText('Edit Settings')).not.toBeInTheDocument();
    });
  });
});