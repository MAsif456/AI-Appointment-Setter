/**
 * Unit tests for the clinic API service layer.
 *
 * Tests the data transformation from frontend form state to the
 * backend DTO shape, and verifies error handling for API responses.
 */

const mockFetch = jest.fn();
global.fetch = mockFetch;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClinic } = require('@/services/clinicService');

/**
 * Builds a sample frontend form data object with default values,
 * and applies any overriding values provided in the overrides object.
 *
 * @param {Record<string, unknown>} overrides - Optional object with overrides for the default form data.
 * @returns {Record<string, unknown>} - The sample form data object with default or overridden values.
 */
function buildFormData(overrides: Record<string, unknown> = {}) {
  return {
    clinicName: 'Cardiff Physiotherapy Centre',
    address: '123 Queen Street, Cardiff, CF10 2BX',
    phoneNumber: '029 2034 5678',
    ghlLocationId: 'loc_cardiff_001',
    ghlCalendarId: 'cal_cardiff_001',
    serviceAreas: ['CF', 'NP'],
    servicesOffered: ['Back pain', 'Sports injury'],
    appointmentDuration: 30,
    businessHours: {
      Monday: { open: true, start: '09:00', end: '17:00' },
      Tuesday: { open: true, start: '09:00', end: '17:00' },
      Wednesday: { open: true, start: '09:00', end: '17:00' },
      Thursday: { open: true, start: '09:00', end: '17:00' },
      Friday: { open: true, start: '09:00', end: '17:00' },
      Saturday: { open: false, start: '09:00', end: '17:00' },
      Sunday: { open: false, start: '09:00', end: '17:00' },
    },
    ...overrides,
  };
}

/**
 * Mocks a successful API response for the create clinic endpoint.
 *
 * The mocked response contains a single property, `_id`, with the value
 * '123'. This is sufficient for most tests, but can be overridden if
 * necessary.
 */
function mockSuccess() {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ _id: '123' }) });
}

describe('clinicService', () => {
  beforeEach(() => mockFetch.mockReset());

  it('should rename frontend field names to backend schema names', async () => {
    mockSuccess();
    await createClinic(buildFormData());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.name).toBe('Cardiff Physiotherapy Centre');
    expect(body.phone).toBe('029 2034 5678');
    expect(body.defaultAppointmentDuration).toBe(30);
    expect(body.clinicName).toBeUndefined();
    expect(body.phoneNumber).toBeUndefined();
  });

  it('should transform serviceAreas array to postcode objects', async () => {
    mockSuccess();
    await createClinic(buildFormData({ serviceAreas: ['CF', 'NP', 'SA'] }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.serviceAreas).toEqual([
      { postcodePrefix: 'CF' },
      { postcodePrefix: 'NP' },
      { postcodePrefix: 'SA' },
    ]);
  });

  it('should transform servicesOffered array to service objects', async () => {
    mockSuccess();
    await createClinic(buildFormData({ servicesOffered: ['Back pain', 'Sports injury'] }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.services).toEqual([{ name: 'Back pain' }, { name: 'Sports injury' }]);
  });

  it('should transform businessHours to array with lowercase days', async () => {
    mockSuccess();
    await createClinic(buildFormData());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const monday = body.businessHours.find((h: { day: string }) => h.day === 'monday');
    expect(monday).toEqual({ day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' });
  });

  it('should omit empty optional fields', async () => {
    mockSuccess();
    await createClinic(buildFormData({ address: '', phoneNumber: '', serviceAreas: [] }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.address).toBeUndefined();
    expect(body.phone).toBeUndefined();
    expect(body.serviceAreas).toBeUndefined();
  });

  it('should POST to /clinics with JSON content type', async () => {
    mockSuccess();
    await createClinic(buildFormData());    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/clinics',
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('should throw ApiError with status 409 on duplicate location ID', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'A clinic with this GHL Location ID already exists' }),
    });

    await expect(createClinic(buildFormData())).rejects.toEqual({
      status: 409,
      message: 'A clinic with this GHL Location ID already exists',
    });
  });

  it('should throw ApiError with backend validation message on 400', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: ['Clinic name is required'] }),
    });

    await expect(createClinic(buildFormData())).rejects.toEqual({
      status: 400,
      message: ['Clinic name is required'],
    });
  });
});
