import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClinicsPage from '../app/clinics/page';
import * as api from '@/lib/api/clinics';
import { Clinic } from '@/types/clinic';

// Mock the API module
jest.mock('@/lib/api/clinics');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock next/link and next/navigation
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '123' }),
  usePathname: () => '/clinics',
}));

/** Factory for a sample clinic. */
const makeClinic = (overrides: Partial<Clinic> = {}): Clinic => ({
  _id: '123',
  name: 'Cardiff Physiotherapy Centre',
  ghlLocationId: 'loc_cardiff_001',
  ghlCalendarId: 'cal_cardiff_001',
  address: '123 Queen Street, Cardiff, CF10 2BX',  serviceAreas: [{ postcodePrefix: 'CF' }, { postcodePrefix: 'NP' }],
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

describe('ClinicsPage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders clinics when data is returned from the API', async () => {
    mockedApi.getClinics.mockResolvedValue([makeClinic()]);

    render(<ClinicsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cardiff Physiotherapy Centre')).toBeInTheDocument();
    });
  });

  it('shows empty state when no clinics exist', async () => {
    mockedApi.getClinics.mockResolvedValue([]);

    render(<ClinicsPage />);

    await waitFor(() => {
      expect(screen.getByText('No clinics configured yet')).toBeInTheDocument();
    });
  });

  it('shows "No clinics found" when search returns empty', async () => {
    mockedApi.getClinics
      .mockResolvedValueOnce([makeClinic()])
      .mockResolvedValueOnce([]);

    render(<ClinicsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cardiff Physiotherapy Centre')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Search clinics...');
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).type(input, 'Nonexistent');

    jest.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText('No clinics found')).toBeInTheDocument();
    });
  });

  it('calls deactivateClinic when deactivate is selected from the menu', async () => {
    mockedApi.getClinics.mockResolvedValue([makeClinic()]);
    mockedApi.deactivateClinic.mockResolvedValue(makeClinic({ isActive: false }));

    render(<ClinicsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cardiff Physiotherapy Centre')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText('Clinic actions');
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).click(menuButton);
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).click(screen.getByText('Deactivate Clinic'));

    await waitFor(() => {
      expect(mockedApi.deactivateClinic).toHaveBeenCalledWith('123');
    });
  });

  it('calls activateClinic when activate is selected for an inactive clinic', async () => {
    mockedApi.getClinics.mockResolvedValue([makeClinic({ isActive: false })]);
    mockedApi.activateClinic.mockResolvedValue(makeClinic({ isActive: true }));

    render(<ClinicsPage />);

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText('Clinic actions');
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).click(menuButton);
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).click(screen.getByText('Activate Clinic'));

    await waitFor(() => {
      expect(mockedApi.activateClinic).toHaveBeenCalledWith('123');
    });
  });
});
