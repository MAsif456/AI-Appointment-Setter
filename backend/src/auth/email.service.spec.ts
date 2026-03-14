import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should send verification email', async () => {
    await expect(
      service.sendVerificationEmail('test@example.com', '123456'),
    ).resolves.not.toThrow();
  });

  it('should send password reset email', async () => {
    await expect(
      service.sendPasswordResetEmail('test@example.com', '654321'),
    ).resolves.not.toThrow();
  });
});