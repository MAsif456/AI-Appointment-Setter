import { Test } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
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