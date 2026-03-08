import { getClinics, getClinicById, deactivateClinic, activateClinic } from './clinics';
import { Clinic } from '@/types/clinic';

/** Reusable mock clinic for assertions. */
const mockClinic: Clinic = {
  _id: '123',
  name: 'Cardiff Physiotherapy Centre',
  ghlLocationId: 'loc_cardiff_001',
  ghlCalendarId: 'cal_cardiff_001',
  address: '123 Queen Street, Cardiff, CF10 2BX',
  serviceAreas: [{ postcodePrefix: 'CF' }],
  todayLeadsCount: 12,
  todayBookingsCount: 5,
  monthLeadsCount: 245,
  monthBookingsCount: 103,
  defaultAppointmentDuration: 30,
  isActive: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

// Mock the global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getClinics', () => {
  it('should fetch all clinics without search param', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([mockClinic]) });

    const result = await getClinics();

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/clinics');
    expect(result).toEqual([mockClinic]);
  });

  it('should include search param when provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([mockClinic]) });

    await getClinics('Cardiff');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/clinics?search=Cardiff');
  });

  it('should encode special characters in search param', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await getClinics('a & b');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/clinics?search=a%20%26%20b');
  });

  it('should throw when the response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(getClinics()).rejects.toThrow('Failed to fetch clinics');
  });
});

describe('getClinicById', () => {
  it('should fetch a single clinic by id', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockClinic) });

    const result = await getClinicById('123');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/clinics/123');
    expect(result).toEqual(mockClinic);
  });

  it('should throw when the response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(getClinicById('bad')).rejects.toThrow('Failed to fetch clinic bad');
  });
});

describe('deactivateClinic', () => {
  it('should send a PATCH request to deactivate', async () => {
    const deactivated = { ...mockClinic, isActive: false };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(deactivated) });

    const result = await deactivateClinic('123');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/clinics/123/deactivate', {
      method: 'PATCH',
    });
    expect(result.isActive).toBe(false);
  });

  it('should throw when the response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(deactivateClinic('123')).rejects.toThrow('Failed to deactivate clinic 123');
  });
});

describe('activateClinic', () => {
  it('should send a PATCH request to activate', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockClinic) });

    const result = await activateClinic('123');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/clinics/123/activate', {
      method: 'PATCH',
    });
    expect(result.isActive).toBe(true);
  });

  it('should throw when the response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(activateClinic('123')).rejects.toThrow('Failed to activate clinic 123');
  });
});
