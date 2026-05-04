import { Clinic, ClinicSchema } from './clinic.schema';

describe('ClinicSchema', () => {
  it('should create schema', () => {
    expect(ClinicSchema).toBeDefined();
  });

  it('should create clinic object', () => {
    const clinic = new Clinic();

    clinic.name = 'Test Clinic';
    clinic.ghlLocationId = 'loc123';
    clinic.ghlCalendarId = 'cal123';

    expect(clinic.name).toBe('Test Clinic');
  });

  it('should support services array', () => {
    const clinic = new Clinic();

    clinic.services = [];

    expect(Array.isArray(clinic.services)).toBe(true);
  });

  it('should support business hours', () => {
    const clinic = new Clinic();

    clinic.businessHours = [
      { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
    ];

    expect(clinic.businessHours.length).toBe(1);
  });
});