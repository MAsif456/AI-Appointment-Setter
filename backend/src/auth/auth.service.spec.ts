jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EmailService } from './email.service';

describe('AuthService', () => {
  let service: AuthService;
  let emailService: EmailService;

  const mockUser = {
    _id: '123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    passwordHash: 'hashedpassword',
    isActive: true,
    isVerified: true,
    verificationCode: '123456',
    verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
    passwordResetCode: '654321',
    passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
    save: jest.fn().mockResolvedValue(true),
  };

  const mockUserModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-token'),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    emailService = module.get<EmailService>(EmailService);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user and send verification email', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

      const result = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(result.message).toContain('Account created');
    expect(mockEmailService.sendVerificationEmail)
  .toHaveBeenCalledWith(expect.any(String), expect.any(String));
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Test123!@#',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with correct code', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.verifyEmail({
        email: 'test@example.com',
        code: '123456',
      });

      expect(result.message).toContain('verified successfully');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException with invalid code', async () => {
      mockUserModel.findOne.mockResolvedValue({ ...mockUser, verificationCode: '999999' });

      await expect(
        service.verifyEmail({
          email: 'test@example.com',
          code: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with expired code', async () => {
      mockUserModel.findOne.mockResolvedValue({
        ...mockUser,
        verificationCodeExpires: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyEmail({
          email: 'test@example.com',
          code: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendVerificationCode', () => {
    it('should resend verification code', async () => {
      mockUserModel.findOne.mockResolvedValue({ ...mockUser, isVerified: false });

      const result = await service.resendVerificationCode('test@example.com');

      expect(result.message).toContain('resent');
      expect(mockEmailService.sendVerificationEmail)
        .toHaveBeenCalledWith(expect.any(String), expect.any(String));
    });

    it('should throw BadRequestException if already verified', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await expect(service.resendVerificationCode('test@example.com')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not reveal if email does not exist', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await service.resendVerificationCode('nonexistent@example.com');

      expect(result.message).toContain('If the email exists');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.accessToken).toBe('mocked-token');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not verified', async () => {
      mockUserModel.findOne.mockResolvedValue({ ...mockUser, isVerified: false });

      await expect(
        service.login({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password incorrect', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should send reset code to existing email', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.forgotPassword({ email: 'test@example.com' });

      expect(result.message).toContain('If the email exists');
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should not reveal if email does not exist', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nonexistent@example.com' });

      expect(result.message).toContain('If the email exists');
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    
    it('should reset password with valid code', async () => {
  const user = {
    ...mockUser,
    passwordResetCode: '654321',
    passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
    save: jest.fn().mockResolvedValue(true),
  };

  mockUserModel.findOne.mockResolvedValue(user);
  (bcrypt.hash as jest.Mock).mockResolvedValue('newhashedpassword');

  const result = await service.resetPassword({
    email: 'test@example.com',
    code: '654321',
    newPassword: 'NewPass123!@#',
  });

  expect(result.message).toContain('reset successfully');

  expect(user.save).toHaveBeenCalled();
});
    it('should throw BadRequestException with invalid code', async () => {
      mockUserModel.findOne.mockResolvedValue({ ...mockUser, passwordResetCode: '999999' });

      await expect(
        service.resetPassword({
          email: 'test@example.com',
          code: '654321',
          newPassword: 'NewPass123!@#',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with expired code', async () => {
      mockUserModel.findOne.mockResolvedValue({
        ...mockUser,
        passwordResetExpires: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword({
          email: 'test@example.com',
          code: '654321',
          newPassword: 'NewPass123!@#',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateUser', () => {
    it('should validate user successfully', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.validateUser('123');

      expect(result.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(service.validateUser('123')).rejects.toThrow(UnauthorizedException);
    });
  });
});