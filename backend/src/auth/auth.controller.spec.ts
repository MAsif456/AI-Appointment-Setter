import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    createUser: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationLink: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  // ✅ CREATE USER (replaces register)
  describe('createUser', () => {
    it('should create a new user (admin route)', async () => {
      const dto = {
        name: 'Test User',
        email: 'test@example.com',
        role: 'staff',
      };

      mockAuthService.createUser.mockResolvedValue({
        message: 'User created',
        email: dto.email,
      });

      const result = await controller.createUser(dto);

      expect(result.message).toContain('User created');
      expect(mockAuthService.createUser).toHaveBeenCalledWith(dto);
    });
  });

  // ✅ VERIFY EMAIL (now uses token, not DTO)
  describe('verifyEmail', () => {
    it('should verify email using token', async () => {
      const token = 'verification-token';

      mockAuthService.verifyEmail.mockResolvedValue({
        message: 'Email verified successfully',
      });

      const result = await controller.verifyEmail(token);

      expect(result.message).toContain('verified');
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(token);
    });
  });

  // ✅ RESEND VERIFICATION (new endpoint)
  describe('resendVerification', () => {
    it('should resend verification link', async () => {
      const email = 'test@example.com';

      mockAuthService.resendVerificationLink.mockResolvedValue({
        message: 'Verification email sent',
      });

      const result = await controller.resendVerification(email);

      expect(result.message).toContain('Verification');
      expect(mockAuthService.resendVerificationLink).toHaveBeenCalledWith(email);
    });
  });

  // ✅ LOGIN (unchanged)
  describe('login', () => {
    it('should login user', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };

      mockAuthService.login.mockResolvedValue({
        user: { email: 'test@example.com' },
        accessToken: 'token',
      });

      const result = await controller.login(loginDto);

      expect(result.accessToken).toBe('token');
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  // ✅ FORGOT PASSWORD (unchanged)
  describe('forgotPassword', () => {
    it('should send password reset link', async () => {
      const dto = { email: 'test@example.com' };

      mockAuthService.forgotPassword.mockResolvedValue({
        message: 'If the email exists, a reset link has been sent.',
      });

      const result = await controller.forgotPassword(dto);

      expect(result.message).toContain('reset');
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });

  // ✅ RESET PASSWORD (unchanged)
  describe('resetPassword', () => {
    it('should reset password', async () => {
      const dto = {
        token: 'reset-token',
        newPassword: 'NewPass123!',
      };

      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Password reset successfully',
      });

      const result = await controller.resetPassword(dto);

      expect(result.message).toContain('reset successfully');
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });

  // ✅ CHANGE PASSWORD (new)
  describe('changePassword', () => {
    it('should change password for authenticated user', async () => {
      const req = { user: { _id: 'user123' } };
      const dto = {
        currentPassword: 'oldPass',
        newPassword: 'newPass',
      };

      mockAuthService.changePassword.mockResolvedValue({
        message: 'Password changed successfully',
      });

      const result = await controller.changePassword(req, dto);

      expect(result.message).toContain('changed');
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        'user123',
        dto,
      );
    });
  });

  // ✅ LOGOUT (unchanged but now guarded)
  describe('logout', () => {
    it('should logout', async () => {
      const result = await controller.logout();
      expect(result.message).toBe('Logged out successfully');
    });
  });

  // ✅ GET CURRENT USER (renamed route: /me)
  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const req = { user: { email: 'test@example.com' } };

      const result = await controller.getCurrentUser(req);

      expect(result.email).toBe('test@example.com');
    });
  });
});