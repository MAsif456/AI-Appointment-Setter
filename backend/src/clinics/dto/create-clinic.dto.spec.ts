import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateClinicDto, BusinessHoursDto, ServiceAreaDto } from './create-clinic.dto';

/**
 * Validation tests for CreateClinicDto and its nested DTOs.
 *
 * Uses class-validator's validate() directly to test each rule
 * without needing an HTTP server or NestJS app.
 */
describe('CreateClinicDto validation', () => {
/**
 * Validates a CreateClinicDto object using class-validator's validate() method.
 * Converts the provided data into a CreateClinicDto object using class-transformer's plainToInstance()
 * before validating it.
 * Returns a Promise of an Array of ValidationErrors, which will be empty if the
 * CreateClinicDto object is valid.
 * @param data - The data to validate as a CreateClinicDto object.
 * @returns A Promise of an Array of ValidationErrors.
 */
  async function validateDto(data: Record<string, unknown>) {
    return validate(plainToInstance(CreateClinicDto, data));
  }

  it('should pass with valid required fields only', async () => {
    const errors = await validateDto({
      name: 'Test Clinic',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'cal_test_001',
    });
    expect(errors).toHaveLength(0);
  });

  it('should pass with all fields filled correctly', async () => {
    const errors = await validateDto({
      name: 'Cardiff Physiotherapy Centre',
      ghlLocationId: 'loc_cardiff_001',
      ghlCalendarId: 'cal_cardiff_001',
      address: '123 Queen Street, Cardiff, CF10 2BX',
      phone: '029 2034 5678',
      defaultAppointmentDuration: 30,
      serviceAreas: [{ postcodePrefix: 'CF' }, { postcodePrefix: 'NP' }],
      services: [{ name: 'Back pain', durationMinutes: 30 }],
      businessHours: [
        { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { day: 'saturday', isOpen: false },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject empty clinic name', async () => {
    const errors = await validateDto({
      name: '',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'cal_test_001',
    });
    expect(errors.find((e) => e.property === 'name')!.constraints).toHaveProperty('isNotEmpty');
  });

  it('should reject missing ghlLocationId', async () => {
    const errors = await validateDto({ name: 'Test Clinic', ghlCalendarId: 'cal_test_001' });
    expect(errors.find((e) => e.property === 'ghlLocationId')).toBeDefined();
  });

  it('should reject missing ghlCalendarId', async () => {
    const errors = await validateDto({ name: 'Test Clinic', ghlLocationId: 'loc_test_001' });
    expect(errors.find((e) => e.property === 'ghlCalendarId')).toBeDefined();
  });

  it('should reject clinic name shorter than 2 characters', async () => {
    const errors = await validateDto({
      name: 'A',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'cal_test_001',
    });
    expect(errors.find((e) => e.property === 'name')?.constraints).toHaveProperty('minLength');
  });

  it('should reject ghlLocationId without loc_ prefix', async () => {
    const errors = await validateDto({
      name: 'Test Clinic',
      ghlLocationId: 'invalid_id',
      ghlCalendarId: 'cal_test_001',
    });
    expect(errors.find((e) => e.property === 'ghlLocationId')?.constraints).toHaveProperty('matches');
  });

  it('should reject ghlCalendarId without cal_ prefix', async () => {
    const errors = await validateDto({
      name: 'Test Clinic',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'bad_calendar',
    });
    expect(errors.find((e) => e.property === 'ghlCalendarId')?.constraints).toHaveProperty('matches');
  });

  it('should accept UK phone starting with 0', async () => {
    const errors = await validateDto({
      name: 'Test Clinic',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'cal_test_001',
      phone: '029 2034 5678',
    });
    expect(errors).toHaveLength(0);
  });

  it('should accept UK phone starting with +44', async () => {
    const errors = await validateDto({
      name: 'Test Clinic',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'cal_test_001',
      phone: '+44 29 2034 5678',
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid phone number', async () => {
    const errors = await validateDto({
      name: 'Test Clinic',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'cal_test_001',
      phone: 'not a phone number',
    });
    expect(errors.find((e) => e.property === 'phone')).toBeDefined();
  });

  it('should reject invalid appointment duration', async () => {
    const errors = await validateDto({
      name: 'Test Clinic',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'cal_test_001',
      defaultAppointmentDuration: 25,
    });
    expect(errors.find((e) => e.property === 'defaultAppointmentDuration')).toBeDefined();
  });

  it('should accept valid appointment duration', async () => {
    const errors = await validateDto({
      name: 'Test Clinic',
      ghlLocationId: 'loc_test_001',
      ghlCalendarId: 'cal_test_001',
      defaultAppointmentDuration: 45,
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject lowercase postcode prefix', async () => {
    const dto = plainToInstance(ServiceAreaDto, { postcodePrefix: 'cf' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('should reject postcode prefix longer than 4 chars', async () => {
    const dto = plainToInstance(ServiceAreaDto, { postcodePrefix: 'ABCDE' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('should accept valid postcode prefixes', async () => {
    for (const prefix of ['CF', 'NP', 'B']) {
      const dto = plainToInstance(ServiceAreaDto, { postcodePrefix: prefix });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('should reject invalid day name in business hours', async () => {
    const dto = plainToInstance(BusinessHoursDto, {
      day: 'Funday', isOpen: true, openTime: '09:00', closeTime: '17:00',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('should reject invalid time format in business hours', async () => {
    const dto = plainToInstance(BusinessHoursDto, {
      day: 'monday', isOpen: true, openTime: '9am', closeTime: '5pm',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('should accept a closed day without time values', async () => {
    const dto = plainToInstance(BusinessHoursDto, { day: 'sunday', isOpen: false });
    expect(await validate(dto)).toHaveLength(0);
  });
});
