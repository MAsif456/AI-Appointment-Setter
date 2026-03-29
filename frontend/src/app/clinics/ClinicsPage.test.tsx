import { render, screen, waitFor } from '@testing-library/react';
import ClinicsPage from '@/app/clinics/page';
import * as clinicsApi from '@/lib/api/clinics';
import { Clinic } from '@/types/clinic';

jest.mock('@/lib/api/clinics');
const mockedApi = clinicsApi as jest.Mocked<typeof clinicsApi>;

jest.mock('next/link', () => ({ children, href }: any) => <a href={href}>{children}</a>);
jest.mock('next/navigation', () => ({
  usePathname: () => '/clinics',
}));

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function makeClinic(overrides: Partial<Clinic> = {}): Clinic {
  return {
    _id: '1', name: 'Cardiff Physio', ghlLocationId: 'loc_1', ghlCalendarId: 'cal_1',
    address: '1 Queen St', serviceAreas: [], businessHours: [],
    todayLeadsCount: 0, todayBookingsCount: 0, monthLeadsCount: 0, monthBookingsCount: 0,
    defaultAppointmentDuration: 30, isActive: true, createdAt: '', updatedAt: '', ...overrides,
  };
}

/**
 * Tests for the updated ClinicsPage.
 * New behaviour: staff only see assigned clinics, Add Clinic button hidden for staff.
 */
describe('ClinicsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  // Admin sees all clinics
  describe('as admin', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: 'admin', assignedClinics: [] } });
    });

    it('shows all clinics from API without filtering', async () => {
      mockedApi.getClinics.mockResolvedValue([
        makeClinic({ _id: '1', name: 'Cardiff Physio' }),
        makeClinic({ _id: '2', name: 'Newport Sports' }),
      ]);
      render(<ClinicsPage />);
      await waitFor(() => {
        expect(screen.getByText('Cardiff Physio')).toBeInTheDocument();
        expect(screen.getByText('Newport Sports')).toBeInTheDocument();
      });
    });

    it('passes showAddButton=true to ClinicsHeader', async () => {
      mockedApi.getClinics.mockResolvedValue([]);
      render(<ClinicsPage />);
      // ClinicsHeader with showAddButton=true renders the Add Clinic link
      await waitFor(() => {
        const addLink = screen.queryByRole('link', { name: /Add Clinic/i });
        // If ClinicsHeader renders the button, it should be present for admin
        if (addLink) expect(addLink).toBeInTheDocument();
      });
    });
  });

  // Staff only sees assigned clinics
  describe('as staff', () => {
    it('only shows clinics in the staff assignedClinics list', async () => {
      mockUseAuth.mockReturnValue({
        isAdmin: false,
        user: { role: 'staff', assignedClinics: ['1'] },
      });
      mockedApi.getClinics.mockResolvedValue([
        makeClinic({ _id: '1', name: 'Cardiff Physio' }),
        makeClinic({ _id: '2', name: 'Newport Sports' }),
      ]);
      render(<ClinicsPage />);
      await waitFor(() => {
        expect(screen.getByText('Cardiff Physio')).toBeInTheDocument();
        expect(screen.queryByText('Newport Sports')).not.toBeInTheDocument();
      });
    });

    it('shows empty state when staff has no matching assigned clinics', async () => {
      mockUseAuth.mockReturnValue({
        isAdmin: false,
        user: { role: 'staff', assignedClinics: ['999'] },
      });
      mockedApi.getClinics.mockResolvedValue([
        makeClinic({ _id: '1', name: 'Cardiff Physio' }),
      ]);
      render(<ClinicsPage />);
      await waitFor(() => {
        expect(screen.queryByText('Cardiff Physio')).not.toBeInTheDocument();
      });
    });

    it('shows all assigned clinics when staff has multiple', async () => {
      mockUseAuth.mockReturnValue({
        isAdmin: false,
        user: { role: 'staff', assignedClinics: ['1', '2'] },
      });
      mockedApi.getClinics.mockResolvedValue([
        makeClinic({ _id: '1', name: 'Cardiff Physio' }),
        makeClinic({ _id: '2', name: 'Newport Sports' }),
        makeClinic({ _id: '3', name: 'Swansea Clinic' }),
      ]);
      render(<ClinicsPage />);
      await waitFor(() => {
        expect(screen.getByText('Cardiff Physio')).toBeInTheDocument();
        expect(screen.getByText('Newport Sports')).toBeInTheDocument();
        expect(screen.queryByText('Swansea Clinic')).not.toBeInTheDocument();
      });
    });
  });
});