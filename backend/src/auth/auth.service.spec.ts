jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EmailService } from './email.service';

describe('AuthService', () => {
  let service: AuthService;
  let model: any;

  const mockUser = (overrides = {}) => ({
    _id: '123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'staff',
    passwordHash: 'hashed',
    isActive: true,
    isVerified: true,
    assignedClinics: ['1'],
    verificationToken: 'token',
    verificationTokenExpires: new Date(Date.now() + 10000),
    passwordResetToken: 'reset',
    passwordResetExpires: new Date(Date.now() + 10000),
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(async () => {
    model = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken('User'), useValue: model },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('token') } },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createUser', () => {
    it('should create user + send email', async () => {
      model.findOne.mockResolvedValue(null);
      model.create.mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const res = await service.createUser({
        name: 'Test',
        email: 'test@example.com',
        password: 'Pass123!',
        role: 'staff',
        assignedClinics: ['507f1f77bcf86cd799439011'],
      });

      expect(res.message).toContain('Account created');
    });

    it('should throw if email exists', async () => {
      model.findOne.mockResolvedValue(mockUser());
      await expect(
        service.createUser({ name: 'x', email: 'test@example.com', password: 'Pass123!', role: 'admin' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw if staff has no clinics', async () => {
      model.findOne.mockResolvedValue(null);

      await expect(
        service.createUser({ name: 'x', email: 't@test.com', password: 'Pass123!', role: 'staff' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify valid token', async () => {
      const user = mockUser();
      model.findOne.mockResolvedValue(user);

      const res = await service.verifyEmail('token');

      expect(user.isVerified).toBe(true);
      expect(user.save).toHaveBeenCalled();
      expect(res.message).toContain('verified');
    });

    it('should throw if invalid/expired', async () => {
      model.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('bad')).rejects.toThrow(BadRequestException);

      model.findOne.mockResolvedValue(mockUser({ verificationTokenExpires: new Date(Date.now() - 1) }));
      await expect(service.verifyEmail('token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendVerificationLink', () => {
    it('should resend if unverified', async () => {
      const user = mockUser({ isVerified: false });
      model.findOne.mockResolvedValue(user);

      const res = await service.resendVerificationLink('test@example.com');

      expect(user.save).toHaveBeenCalled();
      expect(res.message).toContain('If the account exists');
    });

    it('should return safe response otherwise', async () => {
      model.findOne.mockResolvedValue(null);
      const res = await service.resendVerificationLink('x@test.com');
      expect(res.message).toContain('If the account exists');

      model.findOne.mockResolvedValue(mockUser({ isVerified: true }));
      const res2 = await service.resendVerificationLink('x@test.com');
      expect(res2.message).toContain('If the account exists');
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const user = mockUser();
      model.findOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.login({ email: 'test@example.com', password: 'pass' });

      expect(res.accessToken).toBe('token');
      expect(user.save).toHaveBeenCalled();
    });

    it('should fail if not found or inactive', async () => {
      model.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'a', password: 'b' })).rejects.toThrow(UnauthorizedException);

      model.findOne.mockResolvedValue(mockUser({ isActive: false }));
      await expect(service.login({ email: 'a', password: 'b' })).rejects.toThrow(UnauthorizedException);
    });

    it('should fail if not verified', async () => {
      model.findOne.mockResolvedValue(mockUser({ isVerified: false }));
      await expect(service.login({ email: 'a', password: 'b' })).rejects.toThrow(UnauthorizedException);
    });

    it('should fail if password wrong', async () => {
      model.findOne.mockResolvedValue(mockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'a', password: 'b' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user', async () => {
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser()) });
      const res = await service.validateUser('id');
      expect(res).toBeDefined();
    });

    it('should throw if invalid', async () => {
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      await expect(service.validateUser('id')).rejects.toThrow(UnauthorizedException);

      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser({ isActive: false })) });
      await expect(service.validateUser('id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should send email if user exists', async () => {
      const user = mockUser();
      model.findOne.mockResolvedValue(user);

      const res = await service.forgotPassword({ email: 'test@example.com' });

      expect(user.save).toHaveBeenCalled();
      expect(res.message).toContain('If the email exists');
    });

    it('should return safe if not found', async () => {
      model.findOne.mockResolvedValue(null);
      const res = await service.forgotPassword({ email: 'x@test.com' });
      expect(res.message).toContain('If the email exists');
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      const user = mockUser();
      model.findOne.mockResolvedValue(user);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new');

      const res = await service.resetPassword({ token: 'reset', newPassword: 'Pass123!' });

      expect(user.save).toHaveBeenCalled();
      expect(res.message).toContain('Password reset');
    });

    it('should throw if invalid/expired', async () => {
      model.findOne.mockResolvedValue(null);
      await expect(service.resetPassword({ token: 'x', newPassword: 'p' })).rejects.toThrow(BadRequestException);

      model.findOne.mockResolvedValue(mockUser({ passwordResetExpires: new Date(Date.now() - 1) }));
      await expect(service.resetPassword({ token: 'x', newPassword: 'p' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      const user = mockUser();
      model.findById.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new');

      const res = await service.changePassword('id', {
        currentPassword: 'old',
        newPassword: 'newPass1!',
      });

      expect(user.save).toHaveBeenCalled();
      expect(res.message).toContain('updated');
    });

    it('should throw if user not found', async () => {
      model.findById.mockResolvedValue(null);
      await expect(service.changePassword('id', {} as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if current password wrong', async () => {
      model.findById.mockResolvedValue(mockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('id', { currentPassword: 'x', newPassword: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});