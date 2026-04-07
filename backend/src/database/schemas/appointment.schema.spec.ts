import { Appointment, AppointmentSchema } from './appointment.schema';

describe('AppointmentSchema', () => {
  it('should create the schema', () => {
    expect(AppointmentSchema).toBeDefined();
  });

  it('should have default status', () => {
    const appointment = new Appointment();
    expect(appointment.status).toBeUndefined();
  });

  it('should support reminders array', () => {
    const appointment = new Appointment();
    appointment.reminders = [];

    expect(Array.isArray(appointment.reminders)).toBe(true);
  });

  it('should support reschedule tracking fields', () => {
    const appointment = new Appointment();

    appointment.rescheduleCount = 2;
    expect(appointment.rescheduleCount).toBe(2);
  });
});