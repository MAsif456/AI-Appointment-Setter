import { AuditLog, AuditLogSchema } from './audit-log.schema';

describe('AuditLogSchema', () => {
  it('should create schema', () => {
    expect(AuditLogSchema).toBeDefined();
  });

  it('should create audit log object', () => {
    const log = new AuditLog();

    log.action = 'clinic.created';
    log.entityType = 'clinic';

    expect(log.action).toBe('clinic.created');
    expect(log.entityType).toBe('clinic');
  });

  it('should allow metadata object', () => {
    const log = new AuditLog();

    log.metadata = { test: true };

    expect(log.metadata).toEqual({ test: true });
  });
});