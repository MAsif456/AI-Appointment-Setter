import { Test } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

/** Mock nodemailer */
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'id' });
const createTransportMock = nodemailer.createTransport as jest.Mock;

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

/** Helper to build service */
const buildService = async (env: Record<string, string> = {}) => {
  const module = await Test.createTestingModule({
    providers: [
      EmailService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => env[key],
        },
      },
    ],
  }).compile();

  return module.get(EmailService);
};

describe('EmailService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('constructor', () => {
    it('should create transporter with config values', async () => {
      await buildService({
        EMAIL_HOST: 'smtp.test.com',
        EMAIL_PORT: '2525',
        EMAIL_USER: 'user',
        EMAIL_PASS: 'pass',
      });

      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.test.com',
          port: 2525,
          auth: { user: 'user', pass: 'pass' },
        }),
      );
    });

    it('should use default values if config missing', async () => {
      await buildService({});

      expect(createTransportMock).toHaveBeenCalledWith(
          expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 587,
        }),
      );
    });

    // AC: port 465 → implicit TLS (secure: true)
    it('sets secure=true and requireTLS=false when EMAIL_PORT=465', async () => {
      await buildService({ EMAIL_PORT: '465' });
      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ port: 465, secure: true, requireTLS: false }),
      );
    });

    // AC: port 587 → STARTTLS enforced (requireTLS: true) to prevent stripping attacks
    it('sets requireTLS=true and secure=false when EMAIL_PORT=587', async () => {
      await buildService({ EMAIL_PORT: '587' });
      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ port: 587, secure: false, requireTLS: true }),
      );
    });

    // AC: default (no EMAIL_PORT) → falls back to port 587 with requireTLS=true
    it('defaults to port 587 with requireTLS=true when EMAIL_PORT is not set', async () => {
      await buildService({});
      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ port: 587, secure: false, requireTLS: true }),
      );
    });

    // AC: EMAIL_SECURE=true overrides port heuristic
    it('sets secure=true when EMAIL_SECURE=true regardless of port', async () => {
      await buildService({ EMAIL_PORT: '587', EMAIL_SECURE: 'true' });
      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true, requireTLS: false }),
      );
    });

    // AC: EMAIL_REQUIRE_TLS=true overrides port heuristic
    it('sets requireTLS=true when EMAIL_REQUIRE_TLS=true regardless of port', async () => {
      await buildService({ EMAIL_PORT: '465', EMAIL_REQUIRE_TLS: 'true' });
      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ secure: false, requireTLS: true }),
      );
    });

    // AC: local dev (port 1025 / Mailhog) uses neither flag
    it('sets secure=false and requireTLS=false for local dev port 1025', async () => {
      await buildService({ EMAIL_PORT: '1025' });
      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ port: 1025, secure: false, requireTLS: false }),
      );
    });
  });

  describe('onModuleInit', () => {
    let loggerErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    afterEach(() => loggerErrorSpy.mockRestore());

    // AC: EMAIL_PORT=25 in production triggers error log
    it('logs an error when EMAIL_PORT=25 in production', async () => {
      const service = await buildService({ EMAIL_PORT: '25', NODE_ENV: 'production' });
      service.onModuleInit();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('EMAIL_PORT=25'),
      );
    });

    // AC: EMAIL_PORT=25 in development does NOT log an error
    it('does not log an error when EMAIL_PORT=25 in development', async () => {
      const service = await buildService({ EMAIL_PORT: '25', NODE_ENV: 'development' });
      service.onModuleInit();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    // AC: no warning on valid production port
    it('does not log an error when EMAIL_PORT=587 in production', async () => {
      const service = await buildService({ EMAIL_PORT: '587', NODE_ENV: 'production' });
      service.onModuleInit();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send email with correct fields', async () => {
      const service = await buildService({
        FRONTEND_URL: 'http://localhost:3000',
        EMAIL_FROM: 'from@test.com',
      });

      await service.sendVerificationEmail('user@test.com', 'token123');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'from@test.com',
          to: 'user@test.com',
          subject: 'Verify your AppointHealth AI account',
        }),
      );
    });

    it('should include correct verification link', async () => {
      const service = await buildService({
        FRONTEND_URL: 'https://app.com',
      });

      await service.sendVerificationEmail('user@test.com', 'abc');

      const html = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('https://app.com/verify-email?token=abc');
    });

    it('should fallback to default URL and sender', async () => {
      const service = await buildService({});

      await service.sendVerificationEmail('user@test.com', 'abc');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.from).toBe('noreply@appointhealth.com');
      expect(call.html).toContain('http://localhost:3000/verify-email?token=abc');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send email with correct fields', async () => {
      const service = await buildService({
        EMAIL_FROM: 'from@test.com',
      });

      await service.sendPasswordResetEmail('user@test.com', 'reset123');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'from@test.com',
          to: 'user@test.com',
          subject: 'Reset your AppointHealth AI password',
        }),
      );
    });

    it('should include correct reset link', async () => {
      const service = await buildService({
        FRONTEND_URL: 'https://app.com',
      });

      await service.sendPasswordResetEmail('user@test.com', 'xyz');

      const html = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('https://app.com/reset-password?token=xyz');
    });

    it('should fallback to defaults', async () => {
      const service = await buildService({});

      await service.sendPasswordResetEmail('user@test.com', 'xyz');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.from).toBe('noreply@appointhealth.com');
      expect(call.html).toContain('http://localhost:3000/reset-password?token=xyz');
    });
  });
});