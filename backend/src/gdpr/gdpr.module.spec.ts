import { GdprModule } from './gdpr.module';
import { Logger } from '@nestjs/common';

describe('GdprModule', () => {
  let module: GdprModule;

  beforeEach(() => {
    module = new GdprModule();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.FIELD_ENCRYPTION_KEY;
  });

  it('should warn when FIELD_ENCRYPTION_KEY is not set', () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    module.onModuleInit();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('FIELD_ENCRYPTION_KEY is not set'),
    );
  });

  it('should throw when FIELD_ENCRYPTION_KEY is not 64 hex characters', () => {
    process.env.FIELD_ENCRYPTION_KEY = 'tooshort';
    expect(() => module.onModuleInit()).toThrow(
      'FIELD_ENCRYPTION_KEY must be exactly 64 hex characters',
    );
  });

  it('should throw when FIELD_ENCRYPTION_KEY contains non-hex characters', () => {
    process.env.FIELD_ENCRYPTION_KEY = 'g'.repeat(64);
    expect(() => module.onModuleInit()).toThrow(
      'FIELD_ENCRYPTION_KEY must be exactly 64 hex characters',
    );
  });

  it('should log success when FIELD_ENCRYPTION_KEY is valid', () => {
    process.env.FIELD_ENCRYPTION_KEY = 'a'.repeat(64);
    module.onModuleInit();
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      expect.stringContaining('field-level encryption is ACTIVE'),
    );
  });

  it('should accept uppercase hex characters', () => {
    process.env.FIELD_ENCRYPTION_KEY = 'ABCDEF0123456789'.repeat(4);
    expect(() => module.onModuleInit()).not.toThrow();
  });
});
